# Staff Manager — спецификация бэкэнда и логики работы

> Документ описывает, как должен работать сайт целиком и что нужно реализовать на сервере,
> чтобы заменить MSW-моки (`src/mocks/*`) настоящим API. Фронтенд уже написан под этот контракт:
> все пути, методы и формы JSON ниже совпадают с `src/features/*/api/*.ts` и `src/types/index.ts`.

---

## 1. Назначение системы

Внутренняя система для персонала отеля (Michelangelo Hotel):

1. **Сотрудники** — справочник персонала, отделы, роли.
2. **График смен** — месячный график: дневная (D) / ночная (N) смена, отпуск (H), больничный (S), недоступен (×).
3. **Задачи смены (To-Do)** — чек-листы для дневной и ночной смены, чтобы ничего не забыть. *(новое)*
4. **Передача смены (Handover)** — информация для следующей смены с подтверждением «прочитал / принял меры». *(новое)*
5. **Объявления** — общие новости от менеджмента.
6. **Уведомления** — персональная лента событий пользователя.
7. **Профиль** — смена данных и пароля.

### Роли

| Роль | Кто это | Что может |
|---|---|---|
| `ADMIN` | директор / IT | всё, включая удаление сотрудников и смен |
| `MANAGER` | руководитель отдела | сотрудники (без удаления), смены, объявления, шаблоны задач, все записи передачи смены |
| `EMPLOYEE` | обычный сотрудник | видит свой график, выполняет задачи своей смены, пишет и подтверждает передачу смены |
| `GUEST` | демо-вход | только чтение, никаких изменений (сервер обязан отвечать `403` на любые мутации) |

Матрица прав уже описана во фронте: `src/utils/permissions.ts`. **Сервер должен проверять те же права** —
фронтенд скрывает кнопки, но это не защита.

Новые права, которые нужно добавить (и во фронт, и на сервер):

| Право | ADMIN | MANAGER | EMPLOYEE | GUEST |
|---|:-:|:-:|:-:|:-:|
| `tasks.view` | ✔ | ✔ | ✔ | ✔ |
| `tasks.create` (разовая задача на смену) | ✔ | ✔ | ✔ | |
| `tasks.complete` (поставить галочку) | ✔ | ✔ | ✔ | |
| `tasks.manageTemplates` (повторяющиеся чек-листы) | ✔ | ✔ | | |
| `tasks.delete` | ✔ | ✔ | только свои | |
| `handover.view` | ✔ | ✔ | ✔ | ✔ |
| `handover.create` | ✔ | ✔ | ✔ | |
| `handover.acknowledge` | ✔ | ✔ | ✔ | |
| `handover.resolve` / удалить чужую запись | ✔ | ✔ | | |

---

## 2. Модель смен (общая для графика, задач и передачи)

- Смена = **дата + тип**: `DAY` или `NIGHT`. Это «слот смены» (`shiftSlot`), к нему привязываются задачи и записи передачи.
- Время по умолчанию (настраивается в `settings`):
  - `DAY` — 07:00–19:00
  - `NIGHT` — 19:00–07:00 следующего дня. **Дата ночной смены = дата её начала.**
    Т.е. ночь с 7 на 8 ноября — это `2026-11-07 / NIGHT`.
- Порядок слотов: `07.11 DAY → 07.11 NIGHT → 08.11 DAY → 08.11 NIGHT → …`
  - «Следующая смена» для `07.11 DAY` — `07.11 NIGHT`; для `07.11 NIGHT` — `08.11 DAY`.
- Текущий слот вычисляет **сервер** по часовому поясу отеля (`Europe/Prague`), а не браузер.
  Эндпоинт: `GET /shift-slots/current` → `{ date, type, startsAt, endsAt, next: { date, type } }`.
- Все даты в API: `YYYY-MM-DD` (локальная дата отеля), время: `HH:mm`, метки времени: ISO-8601 UTC.

### Записи графика

Сейчас коды H / S / × хранятся только в `localStorage` браузера (`staff-shift-codes`) — это нужно перенести на сервер.

```ts
type ShiftType = 'DAY' | 'NIGHT';

interface Shift {                 // существующий тип + новое поле type
  id: string;
  employeeId: string;
  employeeName: string;           // денормализовано для удобства фронта
  date: string;                   // YYYY-MM-DD
  type: ShiftType;                // НОВОЕ: сервер вычисляет из startTime, если не передан
  startTime: string;              // 'HH:mm' или '' (тогда берётся время по умолчанию для type)
  endTime: string;
  department: string;
  notes?: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
}

type AbsenceType = 'PAID_LEAVE' | 'SICK' | 'UNAVAILABLE';   // H / S / ×
interface Absence {
  id: string;
  employeeId: string;
  date: string;
  type: AbsenceType;
  note?: string;
}
```

Правила:
- У сотрудника в один день не может быть одновременно `Absence` и `Shift` → `409 Conflict`.
- Пересечение смен одного сотрудника → смену сохраняем, но шлём уведомление `Shift conflict detected` ADMIN/MANAGER (как сейчас в моках).
- Ночная смена, где `endTime < startTime`, считается переходящей через полночь (учитывать при проверке пересечений!).
- `status` смены обновляется сервером автоматически по времени (`scheduled → in-progress → completed`).

---

## 3. Задачи смены (To-Do) — НОВАЯ СТРАНИЦА `/tasks`

### Зачем
Дневная и ночная смена должны видеть список того, что нужно сделать **именно на их смене**
(«проверить кассу», «распечатать список заездов на завтра», «закрыть террасу в 23:00»), отмечать выполненное
и не терять невыполненное.

### Сущности

```ts
type TaskPriority = 'low' | 'medium' | 'high';
type TaskStatus = 'open' | 'done' | 'skipped';
type ChecklistSection = 'start' | 'during' | 'end';

// Повторяющийся чек-лист (создаёт MANAGER/ADMIN)
interface TaskTemplate {
  id: string;
  title: string;
  description?: string;
  section: ChecklistSection;      // начало / ход смены / завершение
  sortOrder: number;              // порядок пункта внутри главы
  department: string | 'ALL';
  dueTime?: string;               // 'HH:mm' — к какому времени сделать
  priority: TaskPriority;
  createdBy: string;              // userId
}

// Конкретная задача на конкретную смену
interface ShiftTask {
  id: string;
  templateId?: string;            // если создана из шаблона
  title: string;
  description?: string;
  date: string;                   // слот смены
  shiftType: ShiftType;
  department: string | 'ALL';
  section: ChecklistSection;
  sortOrder: number;
  assigneeId?: string;            // employeeId, необязательно (тогда задача на всю смену)
  priority: TaskPriority;
  dueTime?: string;
  status: TaskStatus;
  carriedOverFrom?: string;       // id задачи прошлой смены, если перенесена
  createdBy: string;
  createdByName: string;
  createdAt: string;
  completedBy?: string;
  completedByName?: string;
  completedAt?: string;
  comment?: string;               // комментарий при выполнении/пропуске
}
```

### Логика
1. **Постоянная структура чек-листа.** Шаблоны не зависят от дня недели или типа смены: один и тот же набор пунктов
   и глав применяется каждый день и в дневную, и в ночную смену. При первом запросе слота сервер создаёт его
   `ShiftTask`-экземпляры; отметки выполнения сохраняются отдельно для каждой смены. Генерация идемпотентна:
   уникальный ключ `(templateId, date, shiftType)`. Отдел определяет, кому показывается пункт (`ALL` — всем).
2. **Главы и порядок.** Пункты сгруппированы по этапам «начало смены», «в течение смены» и «конец смены»,
   внутри главы отображаются в порядке `sortOrder`.
3. **Изменение структуры.** MANAGER/ADMIN могут создавать, менять и удалять пункты шаблона.
   Изменение синхронизируется с текущими и будущими сменами; исторические экземпляры сохраняются как были.
   Удаление пункта убирает его экземпляры из текущей/будущих смен, но сохраняет завершённую историю.
4. **Разовые задачи.** Любой сотрудник (не гость) может добавить задачу на **текущую или следующую** смену
   (пример: дневная смена оставляет ночной «позвонить гостю из 204 в 22:00»). Менеджер — на любую дату.
5. **Выполнение.** Сотрудники, менеджеры и администраторы ставят/снимают отметки по одному (`PATCH /tasks/:id`)
   или для всех подходящих пунктов смены атомарным bulk-запросом (`PATCH /tasks/bulk`). Снять чужую отметку может только менеджер.
   `skipped` — только с обязательным `comment` («не успели, причина…»).
6. **Перенос невыполненного.** Когда смена закончилась (cron каждые 5 мин проверяет закончившиеся слоты):
   - все `open` разовые задачи копируются в следующий слот с `carriedOverFrom` и пометкой «перенесено»;
   - задачи из шаблонов не переносятся (на следующей смене будут свои), но остаются в истории как невыполненные;
   - в запись передачи смены (раздел 4) автоматически попадает сводка: «не выполнено: N задач».
   - менеджеру отдела отправляется уведомление `Unfinished shift tasks`, если были `high` задачи.
7. **Напоминание.** Если у задачи есть `dueTime` и она не выполнена через 15 мин после срока — уведомление
   сотрудникам этой смены (`assigneeId` либо всем, кто стоит в графике на этот слот и отдел).
8. **Права видимости.** EMPLOYEE видит задачи своего отдела + `ALL`; MANAGER/ADMIN — все.

### UI страницы `/tasks` (для фронтенда)
- Переключатель слота: `← пред. смена | Сегодня · День / Ночь | след. смена →` (по умолчанию — текущий слот).
- Фильтр по отделу (для менеджера), прогресс-бар и кнопки отметить/снять отметки со всех пунктов.
- Список задач с чекбоксами, приоритетом, сроком, исполнителем, бейджем «перенесено с прошлой смены».
- Кнопка «+ Задача» (выбор: эта смена / следующая смена).
- Вкладка «Шаблоны» (только MANAGER/ADMIN) — CRUD повторяющихся чек-листов.
- На Dashboard — карточка «Задачи текущей смены: 3 открыто».

---

## 4. Передача смены (Handover) — НОВАЯ СТРАНИЦА `/handover`

### Зачем
Уходящая смена оставляет важную информацию следующей («в 312 протекает кран, вызвали мастера на 9:00»,
«гость из 105 оплатит при выезде», «касса: недостача 200 Kč, объяснительная у менеджера»).
Принимающая смена **обязана** отметить, что прочитала, и при необходимости — что приняла меры.

### Сущности

```ts
type HandoverCategory = 'guests' | 'rooms' | 'maintenance' | 'cash' | 'security' | 'other';
type HandoverPriority = 'normal' | 'important' | 'critical';
type HandoverStatus = 'open' | 'acknowledged' | 'resolved';

interface HandoverNote {
  id: string;
  date: string;                   // слот, КОТОРЫЙ передаёт информацию
  shiftType: ShiftType;
  targetDate: string;             // слот, КОТОРОМУ адресована (обычно следующий; можно «на завтра»)
  targetShiftType: ShiftType;
  department: string | 'ALL';
  category: HandoverCategory;
  priority: HandoverPriority;
  title: string;
  content: string;
  requiresAction: boolean;        // нужно ли «принять меры», или достаточно «прочитал»
  status: HandoverStatus;         // вычисляется сервером
  authorId: string;
  authorName: string;
  createdAt: string;
  updatedAt: string;
  acknowledgements: HandoverAck[];
  resolvedBy?: string;
  resolvedAt?: string;
}

interface HandoverAck {
  userId: string;
  userName: string;
  readAt: string;                 // галочка «Прочитал»
  actionTakenAt?: string;         // галочка «Принял меры»
  comment?: string;               // что именно сделано
}
```

### Логика
1. **Создание.** Любой сотрудник (не гость) создаёт запись. По умолчанию `targetDate/targetShiftType` = следующий слот
   (сервер подставляет через логику раздела 2). Можно выбрать «на завтра — день/ночь».
2. **Кто должен подтвердить (получатели).** Сотрудники, стоящие в графике (`Shift`) на целевой слот в отделе записи
   (`ALL` — все отделы). Если в графике никого нет — все активные сотрудники отдела. Список получателей
   сервер возвращает в `GET /handover/:id` как `expectedRecipients: { userId, name }[]`.
3. **Уведомления.** При создании — уведомление каждому получателю (`relatedType: 'handover'`).
   `critical` — дополнительно всем MANAGER/ADMIN.
4. **Подтверждение.** `POST /handover/:id/ack` с `{ read: true }` → ставит `readAt`.
   Если `requiresAction`, то `{ actionTaken: true, comment }` → ставит `actionTakenAt` (комментарий обязателен).
   Повторный вызов обновляет запись того же пользователя (одна ack на пользователя).
5. **Статус записи (вычисляется сервером):**
   - `open` — никто из получателей не подтвердил;
   - `acknowledged` — хотя бы один получатель прочитал (а если `requiresAction` — хотя бы один принял меры);
   - `resolved` — менеджер/автор закрыл запись (`PATCH /handover/:id` `{ status: 'resolved' }`) — уходит в архив.
6. **Эскалация.** `critical` запись не подтверждена через 60 мин после начала целевой смены → уведомление менеджерам.
   `requiresAction` не выполнено до конца целевой смены → запись автоматически переадресуется на следующий слот
   (меняется `targetDate/targetShiftType`, в истории остаётся пометка).
7. **Редактирование.** Автор может редактировать до первого подтверждения; после — только добавлять комментарий.
   Удаление — автор до подтверждения, менеджер — всегда.
8. **Сводка задач.** При закрытии смены (раздел 3, п.4) сервер автоматически создаёт системную запись
   `category: 'other', title: 'Невыполненные задачи смены'` со списком, если такие были.

### UI страницы `/handover`
- Вверху: «Входящие для моей смены» (непрочитанные — выделены, счётчик в сайдбаре как у уведомлений).
- Карточка записи: категория-иконка, приоритет, автор, время, текст,
  чекбоксы **☐ Прочитал** и (если `requiresAction`) **☐ Принял меры** + поле комментария,
  список «кто подтвердил» с временем, кто ещё не подтвердил.
- Вкладки: `Входящие` / `Отправленные моей сменой` / `Архив` (resolved).
- Кнопка «+ Передать информацию» — форма: категория, приоритет, отдел, заголовок, текст, «требует действий», кому (следующая смена / завтра день / завтра ночь).
- Dashboard: блок «Передача смены: 2 непрочитанных, 1 критическая».

---

## 5. Контракт API

Базовый URL: `VITE_API_URL` (по умолчанию `http://localhost:3000/api`).
Авторизация: `Authorization: Bearer <JWT>`. Ошибки: `{ "message": string, "errors"?: Record<string,string> }`.
Коды: `400` валидация, `401` нет/неверный токен, `403` нет прав, `404`, `409` конфликт.

### 5.1 Существующие (фронт уже использует)

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` |
| POST | `/auth/guest` | — | `{ token, user(role GUEST) }` |
| GET | `/auth/me` | — | `User` |
| POST | `/auth/forgot-password` | `{ email }` | `{ message, token }`* |
| POST | `/auth/reset-password` | `{ token, oldPassword, newPassword }` | `{ message }` |
| PATCH | `/auth/profile` | `{ name, login, email }` | `User` |
| POST | `/auth/change-password` | `{ oldPassword, newPassword }` | `{ message }` |
| GET | `/employees` | — | `Employee[]` |
| GET | `/employees/:id` | — | `Employee` |
| POST | `/employees` | `Omit<Employee,'id'>` | `Employee` 201 |
| PUT | `/employees/:id` | `Omit<Employee,'id'>` | `Employee` |
| DELETE | `/employees/:id` | — | 204 (ADMIN) |
| GET | `/shifts` | `?weekStart=YYYY-MM-DD&endDate=YYYY-MM-DD` (endDate не включительно, по умолчанию +7 дней) | `Shift[]` |
| POST | `/shifts` | `Omit<Shift,'id'>` | `Shift` 201 |
| PUT | `/shifts/:id` | `Omit<Shift,'id'>` | `Shift` |
| DELETE | `/shifts/:id` | — | 204 |
| GET | `/notifications` | — | `Notification[]` только текущего пользователя, новые сверху |
| PATCH | `/notifications/:id/read` | — | `Notification` |
| PATCH | `/notifications/read-all` | — | `Notification[]` изменённые |
| DELETE | `/notifications` | — | 204 (удаляет только свои) |
| GET | `/announcements` | — | `Announcement[]` |
| POST | `/announcements` | `{ title, content, priority }` | `Announcement` 201 |
| PATCH | `/announcements/:id` | `{ completed }` | `Announcement` |
| DELETE | `/announcements/:id` | — | 204 |

\* В продакшене `forgot-password` **не должен** возвращать токен в ответе — токен уходит письмом.
Сейчас фронт показывает ссылку из ответа (демо) — после подключения почты убрать.

### 5.2 Новые

| Метод | Путь | Тело / query | Ответ |
|---|---|---|---|
| GET | `/shift-slots/current` | — | `{ date, type, startsAt, endsAt, next }` |
| GET | `/absences` | `?from&to` | `Absence[]` |
| PUT | `/absences` | `{ employeeId, date, type }` (upsert) | `Absence` |
| DELETE | `/absences/:id` | — | 204 |
| GET | `/tasks` | `?date&shiftType&department` | `ShiftTask[]` (генерирует из шаблонов при необходимости) |
| POST | `/tasks` | `{ title, description?, date, shiftType, department, section?, sortOrder?, assigneeId?, priority, dueTime? }` | `ShiftTask` 201 |
| PATCH | `/tasks/:id` | `{ status?, comment?, title?, … }` | `ShiftTask` |
| PATCH | `/tasks/bulk` | `{ ids: string[], status: 'open' \| 'done' }` | `{ updated: number }` |
| DELETE | `/tasks/:id` | — | 204 |
| GET | `/task-templates` | — | `TaskTemplate[]` |
| POST | `/task-templates` | `Omit<TaskTemplate,'id'|'createdBy'>` | `TaskTemplate` 201 |
| PUT | `/task-templates/:id` | то же | `TaskTemplate` |
| DELETE | `/task-templates/:id` | — | 204 |
| GET | `/handover` | `?scope=incoming|outgoing|archive&date&shiftType` | `HandoverNote[]` |
| GET | `/handover/:id` | — | `HandoverNote & { expectedRecipients }` |
| POST | `/handover` | `{ title, content, category, priority, department, requiresAction, targetDate?, targetShiftType? }` | `HandoverNote` 201 |
| PATCH | `/handover/:id` | `{ title?, content?, status?: 'resolved' }` | `HandoverNote` |
| DELETE | `/handover/:id` | — | 204 |
| POST | `/handover/:id/ack` | `{ read?: true, actionTaken?: boolean, comment? }` | `HandoverNote` |
| GET | `/handover/unread-count` | — | `{ count, critical }` (для бейджа в сайдбаре) |

`Notification.relatedType` расширить: `'employee' | 'shift' | 'announcement' | 'task' | 'handover' | 'system'`.

---

## 6. Правила уведомлений (сервер создаёт автоматически)

| Событие | Кому | type |
|---|---|---|
| Сотрудник создан / изменён / удалён | ADMIN+MANAGER, кроме автора | info / warning |
| Изменены данные сотрудника | сам сотрудник (если есть `userId`) | info |
| Назначена смена | сотрудник смены | info |
| Смена изменена / переназначена / отменена | старый и новый сотрудник | info / warning |
| Пересечение смен | ADMIN+MANAGER, кроме автора | warning |
| Новое объявление | все, кроме автора; `high` → warning | info / warning |
| Объявление выполнено | автор объявления | success |
| Новая запись передачи смены | получатели (раздел 4 п.2); `critical` + менеджеры | info / warning / error |
| Критическая запись не подтверждена 60 мин | MANAGER+ADMIN | error |
| Задача не выполнена к сроку | исполнитель / смена | warning |
| Остались невыполненные `high` задачи | менеджер отдела | warning |

Отправитель (`senderName/senderEmail`) = пользователь, совершивший действие; для cron-событий — `Staff Manager <noreply@hotel.com>`.
Сотрудник **никогда** не получает уведомление о собственном действии.

---

## 7. Рекомендуемый стек и структура

- **Node.js 22 + TypeScript + Express 5** (или Fastify) — тот же язык, что фронт, можно переиспользовать типы и Zod-схемы.
- **PostgreSQL** (продакшен) / SQLite (локальная разработка) через **Prisma ORM**.
- **Zod** — валидация тел запросов (схемы те же, что во фронте).
- **JWT** (`jsonwebtoken`) + **bcrypt** для паролей. Срок токена 8–12 ч (длина смены).
- **node-cron** — генерация задач, перенос невыполненных, эскалации.
- **Vitest + supertest** — тесты API.
- Позже: WebSocket / SSE для мгновенных уведомлений вместо опроса раз в 30 сек.

```
backend/
  prisma/schema.prisma        # модели БД
  prisma/seed.ts              # демо-данные (те же, что src/mocks/data/db.ts)
  src/
    app.ts                    # express app, cors, json, роутеры, обработчик ошибок
    server.ts                 # запуск
    config.ts                 # env: PORT, DATABASE_URL, JWT_SECRET, HOTEL_TZ, DAY_START, NIGHT_START
    middleware/auth.ts        # requireAuth, requirePermission(...)
    lib/permissions.ts        # копия матрицы ролей
    lib/shiftSlots.ts         # текущий/следующий слот, чистые функции + тесты
    lib/notify.ts             # notifyUsers / notifyRoles / notifyEmployee
    routes/auth.ts, employees.ts, shifts.ts, absences.ts, notifications.ts,
           announcements.ts, tasks.ts, taskTemplates.ts, handover.ts
    jobs/shiftJobs.ts         # cron: генерация, перенос, эскалация
  test/*.test.ts
```

### Безопасность (обязательно)
- Пароли только в виде bcrypt-хеша; `password` никогда не возвращать в ответах.
- Все мутации: `requireAuth` + `requirePermission`; GUEST → `403`.
- EMPLOYEE может читать только свои уведомления, менять только свои ack/задачи.
- `PUT /employees/:id`: MANAGER не может повышать роль до ADMIN.
- CORS только для домена фронтенда; rate-limit на `/auth/login` и `/auth/forgot-password`.
- Секреты в `.env`, `.env` в `.gitignore`.

---

## 8. Порядок реализации (чек-лист)

> Каркас уже есть в `backend/` (см. `backend/README.md`): пункты 1–11 и 14 реализованы, 12, 13, 15 — нет.

1. [ ] `backend/` каркас: Express, config, обработчик ошибок, `/api/health`.
2. [ ] Prisma-схема + миграция + seed демо-данными.
3. [ ] Auth: login, guest, me, profile, change-password (bcrypt + JWT).
4. [ ] Middleware прав, перенос матрицы ролей.
5. [ ] Employees CRUD + уведомления.
6. [ ] Shifts CRUD + `type` + проверка пересечений (с учётом ночи через полночь) + уведомления.
7. [ ] Absences (перенос кодов H/S/× из localStorage).
8. [ ] Notifications, Announcements.
9. [ ] `shiftSlots` + `/shift-slots/current`.
10. [ ] Tasks + Task templates + генерация.
11. [ ] Handover + ack + вычисление статуса + получатели.
12. [ ] Cron-задачи: перенос, напоминания, эскалации.
13. [ ] Тесты API (supertest) на каждую группу.
14. [ ] Фронт: `VITE_USE_MOCKS=false` → отключить MSW (`src/main.tsx`), проверить все страницы против реального API.
15. [ ] Деплой: Docker Compose (postgres + backend + nginx со статикой фронта).

## 9. Как переключить фронт на реальный бэкэнд

1. В `src/main.tsx` запускать MSW только если `import.meta.env.VITE_USE_MOCKS !== 'false'`.
2. В `.env.local`: `VITE_API_URL=http://localhost:3000/api` и `VITE_USE_MOCKS=false`.
3. Удалить `fetchFn`-обход `signal` в `src/app/baseApi.ts`, если он больше не нужен (он нужен только для MSW в тестах).
4. Обработать `401` глобально: при ответе 401 — `logout()` и редирект на `/login`.
