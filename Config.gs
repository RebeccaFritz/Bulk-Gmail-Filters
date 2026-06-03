const LABEL = {
  NEWSLETTERS:      'Newsletters',
  ALERTS:           'Work/Alerts',
  SOCIAL:           'Social',
  FINANCE:          'Finance',
};

const userId = "me";

// To add a new email type: add a new entry to emailTypes and a new email list below.
const newsletterEmails = [
  'updates@newsletter.com',  
];

const alertEmails = [
  'alerts@work.com',
  'boss@mycompany.com',
];

const socialEmails = [
  'noreply@social.com'
];

const financeEmails = [
  'invoices@billing.com',
];

const emailTypes = [
  // [email list, label, skipInbox, markImportant]
  [newsletterEmails, LABEL.NEWSLETTERS, true, false],
  [alertEmails, LABEL.ALERTS, true, true],
  [socialEmails, LABEL.SOCIAL, false, false],
  [financeEmails, LABEL.FINANCE, false, true],
];
