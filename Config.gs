const LABEL = {
  JOB_SEARCH:     'Job Search',
  IN_PROGRESS:    'Job Search/In Progress',
  HEALTH:         'Health',
  WORK:           'Work',
};

const userId = "me";

// To add a new email type: add a new entry to emailTypes and a new email list below.
const jobSearchEmails = [
  'donotreply@match.indeed.com', 
  'jobalerts-noreply@linkedin.com', 
  'updates-noreply@linkedin.com', 
  'noreply@glassdoor.com', 
  'jobs-noreply@linkedin.com',
  'indeedapply@indeed.com',
  'handshake@notifications.joinhandshake.com'
];

const inProgressEmails = [
  'careers@epic.com',
  'notification@smartrecruiters.com',
  'no-reply@mail.rembrandtadvantage.com',
  'recruiting@hr.careyaya.org',
  'indeedapply@indeed.com'
];

const healthEmails = [
  'support@nourish.com',
  'noreply@advancedmd.com',
  'notifications@televerohealth.com',
  'donotreply@bswhealth.org'
];

const workEmails = [
  'handshake@g.joinhandshake.com',
  'notifications@m.ai.joinhandshake.com',
];

const emailTypes = [
  [jobSearchEmails, LABEL.JOB_SEARCH, true, false],
  [inProgressEmails, LABEL.IN_PROGRESS, true, true],
  [healthEmails, LABEL.HEALTH, true, false],
  [workEmails, LABEL.WORK, true, false],
];
