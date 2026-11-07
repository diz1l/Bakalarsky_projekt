import { delay, http, HttpResponse } from 'msw';
import { db, genId, persistMockCollections } from '../data/db';
import { computeHandoverStatus, forwardOverdueHandovers, getExpectedRecipients, withRecipients } from '../data/handover';
import { notifyUsers } from '../data/notificationEvents';
import type { HandoverNote } from '@/types';
import { hasPermission } from '@/utils/permissions';
import { getCurrentSlot, getNextSlot } from '@/utils/shiftUtils';
import { API, badRequest, forbidden, getRequestUser, notFound } from './utils';

const PRIORITY_ORDER = { critical: 0, important: 1, normal: 2 };

type HandoverPayload = Pick<
  HandoverNote,
  'title' | 'content' | 'category' | 'priority' | 'department' | 'requiresAction'
> &
  Partial<Pick<HandoverNote, 'targetDate' | 'targetShiftType'>>;

export const handoverHandlers = [
  http.get(`${API}/handover`, async ({ request }) => {
    await delay(150);
    forwardOverdueHandovers();
    const scope = new URL(request.url).searchParams.get('scope') ?? 'active';

    const result = db.handoverNotes
      .map(withRecipients)
      .filter((note) => (scope === 'archive' ? note.status === 'resolved' : note.status !== 'resolved'))
      .sort((left, right) =>
        scope === 'archive'
          ? (right.resolvedAt ?? '').localeCompare(left.resolvedAt ?? '')
          : PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
            right.createdAt.localeCompare(left.createdAt),
      );
    return HttpResponse.json(result);
  }),

  http.post(`${API}/handover`, async ({ request }) => {
    await delay(200);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'handover.create')) return forbidden();

    const body = (await request.json()) as HandoverPayload;
    if (!body.title?.trim() || !body.content?.trim()) return badRequest('Title and content are required');

    const current = getCurrentSlot();
    const target = body.targetDate && body.targetShiftType
      ? { date: body.targetDate, type: body.targetShiftType }
      : getNextSlot(current);
    const now = new Date().toISOString();

    const note: HandoverNote = {
      ...body,
      id: genId('hand'),
      title: body.title.trim(),
      content: body.content.trim(),
      date: current.date,
      shiftType: current.type,
      targetDate: target.date,
      targetShiftType: target.type,
      status: 'open',
      authorId: user.id,
      authorName: user.name,
      createdAt: now,
      updatedAt: now,
      acknowledgements: [],
    };
    db.handoverNotes.unshift(note);
    persistMockCollections();

    const content = {
      title: note.priority === 'critical' ? 'Critical shift handover' : 'New shift handover',
      message: note.title,
      type: note.priority === 'critical' ? ('error' as const) : note.priority === 'important' ? ('warning' as const) : ('info' as const),
      relatedType: 'handover' as const,
      relatedId: note.id,
    };
    const recipients = getExpectedRecipients(note).map((recipient) => recipient.userId);
    notifyUsers(recipients, content, user.id);
    if (note.priority === 'critical') {
      const managerIds = db.users
        .filter(
          (entry) =>
            (entry.role === 'ADMIN' || entry.role === 'MANAGER') && entry.id !== user.id && !recipients.includes(entry.id),
        )
        .map((entry) => entry.id);
      notifyUsers(managerIds, content, user.id);
    }
    return HttpResponse.json(withRecipients(note), { status: 201 });
  }),

  http.patch(`${API}/handover/:id`, async ({ params, request }) => {
    await delay(160);
    const user = getRequestUser(request);
    const note = db.handoverNotes.find((entry) => entry.id === params.id);
    if (!note) return notFound();
    if (!user || !hasPermission(user.role, 'handover.create')) return forbidden();

    const canManage = hasPermission(user.role, 'handover.manage');
    const isAuthor = note.authorId === user.id;
    const body = (await request.json()) as Partial<HandoverNote>;

    if (body.status) {
      if (!canManage && !isAuthor) return forbidden();
      if (body.status === 'resolved') {
        note.resolvedAt = new Date().toISOString();
        note.resolvedBy = user.name;
      } else {
        delete note.resolvedAt;
        delete note.resolvedBy;
      }
    }

    const editable = ['title', 'content', 'category', 'priority', 'department', 'requiresAction'] as const;
    if (editable.some((key) => key in body)) {
      if (!canManage && !(isAuthor && !note.acknowledgements.length)) {
        return forbidden('The note can no longer be edited after it was acknowledged.');
      }
      editable.forEach((key) => {
        if (key in body) Object.assign(note, { [key]: body[key] });
      });
    }

    note.updatedAt = new Date().toISOString();
    note.status = computeHandoverStatus(note);
    persistMockCollections();
    return HttpResponse.json(withRecipients(note));
  }),

  http.delete(`${API}/handover/:id`, async ({ params, request }) => {
    await delay(120);
    const user = getRequestUser(request);
    const idx = db.handoverNotes.findIndex((entry) => entry.id === params.id);
    if (idx === -1) return notFound();
    const note = db.handoverNotes[idx];
    const canDelete =
      !!user && (hasPermission(user.role, 'handover.manage') || (note.authorId === user.id && !note.acknowledgements.length));
    if (!canDelete) return forbidden();

    db.handoverNotes.splice(idx, 1);
    persistMockCollections();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post(`${API}/handover/:id/ack`, async ({ params, request }) => {
    await delay(140);
    const user = getRequestUser(request);
    if (!user || !hasPermission(user.role, 'handover.acknowledge')) return forbidden();
    const note = db.handoverNotes.find((entry) => entry.id === params.id);
    if (!note) return notFound();

    const body = (await request.json()) as { read?: boolean; actionTaken?: boolean; comment?: string };
    if (body.actionTaken && !body.comment?.trim()) return badRequest('Describe what was done');

    const now = new Date().toISOString();
    let ack = note.acknowledgements.find((entry) => entry.userId === user.id);
    if (body.read === false && !body.actionTaken) {
      note.acknowledgements = note.acknowledgements.filter((entry) => entry.userId !== user.id);
      ack = undefined;
    } else {
      if (!ack) {
        ack = { userId: user.id, userName: user.name, readAt: now };
        note.acknowledgements.push(ack);
      }
      if (body.actionTaken === true) {
        ack.actionTakenAt = now;
        ack.comment = body.comment!.trim();
      } else if (body.actionTaken === false) {
        delete ack.actionTakenAt;
        delete ack.comment;
      }
    }

    const previousStatus = note.status;
    note.status = computeHandoverStatus(note);
    note.updatedAt = now;
    persistMockCollections();

    if (body.actionTaken && note.authorId !== user.id) {
      notifyUsers(
        [note.authorId],
        {
          title: 'Handover: action taken',
          message: `${user.name}: ${ack?.comment ?? ''} — "${note.title}"`,
          type: 'success',
          relatedType: 'handover',
          relatedId: note.id,
        },
        user.id,
      );
    } else if (previousStatus === 'open' && note.status === 'acknowledged' && note.authorId !== user.id) {
      notifyUsers(
        [note.authorId],
        {
          title: 'Handover acknowledged',
          message: `${user.name} has read "${note.title}".`,
          type: 'success',
          relatedType: 'handover',
          relatedId: note.id,
        },
        user.id,
      );
    }
    return HttpResponse.json(withRecipients(note));
  }),
];
