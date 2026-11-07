import { createContext, useContext } from 'react';
import { shiftOpsCs, shiftOpsRu } from './translations/shiftOps';

export type Locale = 'en' | 'cs' | 'ru';
export const translations: Record<Locale, Record<string, string>> = {
  en: {},
  cs: {
    ...shiftOpsCs,
    Dashboard: 'Přehled', Employees: 'Zaměstnanci', Shifts: 'Směny', Notifications: 'Oznámení', Announcements: 'Novinky', Profile: 'Profil',
    'Shift schedule': 'Plán směn', 'This month': 'Tento měsíc', 'Prev': 'Předchozí', 'Next': 'Další', Employee: 'Zaměstnanec',
    'Add employee': 'Přidat zaměstnance', 'people on schedule': 'lidí v rozpisu', 'Day shift': 'Denní směna', 'Night shift': 'Noční směna',
    'Paid leave': 'Placené volno', Sick: 'Nemoc', Unavailable: 'Nemůže pracovat', 'New Shift': 'Nová směna', 'Edit Shift': 'Upravit směnu',
    'Assigned to': 'Přiřazeno', 'Date': 'Datum', 'Start (optional)': 'Začátek (volitelné)', 'End (optional)': 'Konec (volitelné)',
    'Department': 'Oddělení', 'Notes': 'Poznámky', 'Cancel': 'Zrušit', 'Create': 'Vytvořit', 'Save': 'Uložit', 'Front Desk': 'Recepce',
    'Housekeeping': 'Úklid', 'Restaurant': 'Restaurace', 'Maintenance': 'Údržba', 'Add employee to schedule': 'Přidat zaměstnance do rozpisu',
    'Choose an active employee to add as a new row in this hotel\'s roster.': 'Vyberte aktivního zaměstnance, kterého chcete přidat do rozpisu hotelu.',
    'All active employees are already on the schedule.': 'Všichni aktivní zaměstnanci už jsou v rozpisu.', 'Dark': 'Tmavý režim', 'Light': 'Světlý režim',
    'Language': 'Jazyk', 'Collapse sidebar': 'Skrýt postranní panel', 'Expand sidebar': 'Zobrazit postranní panel', 'Sign out': 'Odhlásit se',
  },
  ru: {
    ...shiftOpsRu,
    Dashboard: 'Обзор', Employees: 'Сотрудники', Shifts: 'Смены', Notifications: 'Уведомления', Announcements: 'Объявления', Profile: 'Профиль',
    'Shift schedule': 'График смен', 'This month': 'Этот месяц', 'Prev': 'Назад', 'Next': 'Вперёд', Employee: 'Сотрудник',
    'Add employee': 'Добавить сотрудника', 'people on schedule': 'чел. в графике', 'Day shift': 'Дневная смена', 'Night shift': 'Ночная смена',
    'Paid leave': 'Оплачиваемый выходной', Sick: 'Больничный', Unavailable: 'Не может работать', 'New Shift': 'Новая смена', 'Edit Shift': 'Изменить смену',
    'Assigned to': 'Сотрудник', 'Date': 'Дата', 'Start (optional)': 'Начало (необязательно)', 'End (optional)': 'Окончание (необязательно)',
    'Department': 'Отдел', 'Notes': 'Заметки', 'Cancel': 'Отмена', 'Create': 'Создать', 'Save': 'Сохранить', 'Front Desk': 'Ресепшен',
    'Housekeeping': 'Уборка', 'Restaurant': 'Ресторан', 'Maintenance': 'Обслуживание', 'Add employee to schedule': 'Добавить сотрудника в график',
    'Choose an active employee to add as a new row in this hotel\'s roster.': 'Выберите активного сотрудника, чтобы добавить его строкой в график отеля.',
    'All active employees are already on the schedule.': 'Все активные сотрудники уже добавлены в график.', 'Dark': 'Тёмная тема', 'Light': 'Светлая тема',
    'Language': 'Язык', 'Collapse sidebar': 'Свернуть панель', 'Expand sidebar': 'Развернуть панель', 'Sign out': 'Выйти',
  },
};
export const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void }>({ locale: 'en', setLocale: () => undefined });
export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext);
  return { locale, setLocale, t: (key: string) => translations[locale][key] ?? key };
}
