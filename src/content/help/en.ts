import type { HelpCatalogue } from "./types";

/**
 * The English workflow guide for the mobile app, written from the screens themselves
 * (`plans/reports/scout-260911-2300-mobile-workflow-inventory.md`). Every step names a control
 * that exists; buttons the app no longer renders are deliberately absent.
 */
export const helpCatalogueEn: HelpCatalogue = [
  {
    id: "getting-started",
    title: "Signing in and joining a company",
    purpose:
      "Folio signs you in with your phone number and a code by SMS — there is no password. Before you can see anything, your account has to belong to a company.",
    steps: [
      "Type your phone number and tap “Send code”. French numbers only, without the leading zero.",
      "Enter the six digits from the SMS. Sign-in happens automatically once the sixth digit is in.",
      "No account yet? Tap “Create an account”, confirm your number the same way, enter your name and tap “Create my profile”.",
      "If you belong to no company, choose “Create a company” — fill in the legal name and address — or “Join with a code” and type the 8-character code your administrator gave you.",
      "If you joined as a member but have no site yet, you wait on “Almost there” until an admin assigns you to a project. Pull down to refresh.",
      "Later on, Settings → “Join another company” opens the same code screen again.",
    ],
    whoCanDoIt:
      "Anyone. “Create an account” only appears when the server allows self sign-up.",
    gotchas: [
      "Only French numbers are accepted at sign-in.",
      "Every onboarding screen has a “Sign out” escape hatch if you picked the wrong account.",
    ],
  },
  {
    id: "shell",
    title: "Finding your way around",
    purpose:
      "One project is selected at a time and the whole app talks about that project. The tab bar holds four project screens; everything else lives behind Menu.",
    steps: [
      "Tap the project name at the top, then pick a site from the list — each row shows its remaining budget.",
      "In that same panel, “+ New project” creates a site: name, address, budget and budget source.",
      "As a manager the four tabs are Overview, Expenses, Labor and Planning. As a worker they are Attendance, Salary, Profile and Planning.",
      "Managers get a “Menu” item for everything else: quotes and invoices, the product library, company members, and the project sections — documents, photos, notes, salaries, chiffrage, analyses, members and settings. Workers do not have it, so the topics below that start from the Menu are theirs to read rather than to follow.",
      "Tap your initials for Settings, the language picker (English, Français, Tiếng Việt) and “Sign out”.",
      "Tap the bell for anything waiting on you, and the question mark for this guide.",
    ],
    whoCanDoIt:
      "Everyone can switch project and open their account. Creating a project needs project-creation rights or company administration. Quotes and invoices, company members and documents only appear for the people allowed into them.",
    gotchas: [
      "The Expenses tab draws its own header with the month stepper, so the bell, your avatar and this guide are not on that screen — open the guide from any other tab.",
      "A new project is created inside your primary company and you become its manager.",
    ],
  },
  {
    id: "overview",
    title: "The project overview",
    purpose:
      "The money and activity summary for the selected site: what is left to spend, what is due, this month's spend, the week ahead and who is on site today.",
    steps: [
      "Read the hero figure at the top — what remains, against “Spent … of … credit”.",
      "Use the quick actions: “Invoice” opens a new expense, “Release funds” opens the same form pre-set to a bank draw, “Pay labor” jumps to the Labor tab on its Payments segment.",
      "Check the due tiles: “Unpaid” leads to “Pay now”, “Awaiting refund” opens the expenses still owed back to you.",
      "Tap the month spend card to open the full ledger for that month.",
      "Tap “Agenda” on the “This week” card to open Planning.",
      "“Today on site” shows how many workers are expected and the weather at the site address.",
    ],
    whoCanDoIt:
      "Anyone on the project. Without budget-viewing rights the bank-credit figure is left out rather than shown as zero.",
    gotchas: [
      "Workers see their own attendance screen here instead of the overview.",
    ],
  },
  {
    id: "planning",
    title: "Tasks and planning",
    purpose:
      "A task board for the site, shown one lane at a time. Managers and workers see the same board.",
    steps: [
      "Pick a lane from the selector: Backlog, To do, In progress, Blocked or Done.",
      "Tap “Task” to add one: a title is required, then description, lane, priority, due date and labels. Tap “Save”.",
      "Tap a card to reopen it for editing.",
      "Tick a card's checkbox to send it straight to Done, or back to To do.",
      "While editing, “Up” and “Down” move the task within its lane.",
      "While editing, “Delete” removes the task after a confirmation.",
    ],
    whoCanDoIt:
      "Anyone on the project can read, create and edit tasks. Deleting needs project-editing rights, so workers cannot delete.",
  },
  {
    id: "attendance",
    title: "Recording attendance",
    purpose:
      "Record which workers were on site each day of the month and what shift they worked. This is what feeds pay.",
    steps: [
      "Choose the month with the stepper at the top of the Labor tab, then the “Attendance” segment.",
      "Switch between “Calendar” and “List”; the row above shows days worked, cost and what is still unpaid.",
      "Tap a day, then “Log this day”.",
      "In the panel, tap each worker who was there, tap their chip to cycle “Full day”, “Half day” or “Overtime”, and use +/− for extra hours. Finish with the “Log …” button.",
      "Tap an entry that already exists to change its shift, extra hours, amount override or note — or to delete it.",
      "Tap “Activities & notes ›” to record what was done that day and a description of the day.",
      "Use the download control to export a range of months, for one worker or all of them.",
    ],
    whoCanDoIt:
      "Anyone who manages attendance on the project. Without that, the Labor tab becomes your own profile instead.",
    gotchas: [
      "Logging a worker already logged on another site the same day asks you to confirm with “Log anyway”.",
    ],
  },
  {
    id: "attendance-validation",
    title: "Approving the days workers declare",
    purpose:
      "Workers declare their own days; you approve or refuse them. This lives in the bell, not in the Labor tab.",
    steps: [
      "Tap the bell in the top bar.",
      "The top block is “Attendance to validate”, one row per worker and day with the shift they declared.",
      "For a new declaration, tap “Validate” to accept it, or “Reject” — rejecting deletes the entry, so it asks first.",
      "When a worker asks to change a day you already approved, the row shows the old and new value; the buttons become “Apply” and “Refuse”.",
      "Refusing a change leaves the day as it was already validated.",
    ],
    whoCanDoIt:
      "The people the site lists as validators — in practice whoever manages attendance. The block is simply absent when nothing is waiting.",
    gotchas: [
      "The bell refreshes about once a minute, so a day declared while you have the app open appears on its own.",
    ],
  },
  {
    id: "workers",
    title: "Workers and daily rates",
    purpose:
      "The crew of this site: who works here, their role, their daily rate, and how that rate has changed over time.",
    steps: [
      "Open the Labor tab and choose the “Workers” segment, then tap “Add worker”.",
      "Pick “Company worker” to take someone from the company directory, or “Someone new” to type them in.",
      "Fill in the name, the daily rate, a phone number, a role, and link an app account if they have one. Tap “Save”.",
      "Tap a worker to reach “Edit”, “Rates” and “Delete”.",
      "“Rates” shows the current rate and its history. Set the date it takes effect and the new rate, read the line telling you how many already-logged days this re-prices, then tap “Add rate change”.",
      "Deleting a worker keeps their attendance history on the site.",
    ],
    whoCanDoIt:
      "Anyone who manages attendance on the project. Picking from the company directory also needs you to administer or manage that company.",
    gotchas: [
      "A rate change is dated, and it re-prices days already logged from that date onwards — the panel warns you before you commit.",
    ],
  },
  {
    id: "labor-payments",
    title: "Paying workers",
    purpose:
      "See what each worker is owed for the month and record what you actually paid them.",
    steps: [
      "Open the Labor tab and choose the “Payments” segment.",
      "Read each worker's row: whether they are due or settled, and how much is paid against how much is owed.",
      "Tap “Record a payment”, or tap the worker's row.",
      "Choose the worker, adjust the amount — it arrives pre-filled with the outstanding balance — and pick a payment method.",
      "Confirm with “Record a payment”.",
      "Below the list, “Labor invoices without a worker” collects labor expenses with nobody attached; tap one to open it and assign it.",
    ],
    whoCanDoIt:
      "Managing attendance gets you the screen; recording a payment also needs invoice rights, and the button is hidden without them.",
    gotchas: [
      "Recording a payment creates a labor expense on the project, so it also appears in the Expenses ledger.",
    ],
  },
  {
    id: "salaries",
    title: "Salaries, month by month",
    purpose:
      "Per worker and per month: what they earned against what has been paid, and what is still outstanding.",
    steps: [
      "Open Menu → Salaries and pick a worker.",
      "Read the totals: total earned, total paid, and what remains outstanding.",
      "Each month card shows whether it is paid, partially paid, unpaid or overpaid, with the days worked and the amounts.",
      "Tap “Mark as paid” on a month, set the amount and the payment method, and confirm.",
      "“Mark as unpaid” removes the payments recorded for that month after a confirmation.",
    ],
    whoCanDoIt:
      "Anyone who can open the section may read it. Changing the paid status needs invoice rights; without them the screen says so plainly.",
    webOnlyNote:
      "The web app has no salaries page — this view exists only on the phone.",
  },
  {
    id: "expenses",
    title: "The expense ledger",
    purpose:
      "Every euro that left the project, month by month: supplier invoices, bank draws, labor payments and supplier credit notes.",
    steps: [
      "Step through months with the arrows at the top of the Expenses tab.",
      "Read the month total, the item count, how it compares with the previous month, and the company and personal purses.",
      "Filter by type: all, released funds, labor, materials and services, or others.",
      "If expenses are waiting to be reimbursed, a banner counts them and “View” opens them.",
      "Tap any row to open that expense in full.",
      "Use “Export Excel / PDF” to export a range of months.",
      "Tap the round + button at the bottom right to record a new expense.",
    ],
    whoCanDoIt:
      "Anyone on the project. Budget-viewing rights control the purse cards and the released-funds filter.",
    gotchas: [
      "The month stepper stops at the most recent month that has data.",
      "Workers see their own salary here instead of the ledger.",
    ],
  },
  {
    id: "expense-create",
    title: "Recording an expense",
    purpose:
      "Enter one expense: a supplier invoice, a labor payment, a draw on the bank credit, or a credit note from a supplier.",
    steps: [
      "Choose the type: released funds, labor, materials and services, others, or return / avoir.",
      "Set the issue date — it is required.",
      "For labor, pick the worker and the service month.",
      "Fill in the recipient, optionally their address, and choose a payment method.",
      "For a return, link the materials-and-services invoice it refunds, say whether it was settled in cash or as a credit note, and if it is a credit note, which invoice it was applied to.",
      "Add at least one item line with a description, quantity, unit price and VAT rate.",
      "Check the totals, add notes or a highlight colour, then tap “Create invoice”.",
    ],
    whoCanDoIt:
      "Anyone on the project can open the form; the server decides whether the expense is accepted. Released funds only appears with budget-viewing rights.",
  },
  {
    id: "expense-detail",
    title: "Attachments and refunds on an expense",
    purpose:
      "Everything about one expense: the amount, who was paid, the lines, the files attached, and whether the company still owes you the money back.",
    steps: [
      "Open an expense from the ledger. The top shows the total, the recipient, the date, the payment method and the purse it came from.",
      "The round buttons are “PDF”, “Attach”, “Edit” and “Delete”.",
      "If you paid a materials-and-services expense yourself, the banner “Paid on behalf of the company?” lets you tap “Transfer” to start tracking it.",
      "Once it is tracked and the company has paid you back, tap “Refunded”.",
      "Under “Attachments”, add a photo, pick from your library, or choose a file. Each file can be opened, renamed or deleted.",
      "The colour swatches set the highlight used for this row in the ledger.",
    ],
    whoCanDoIt:
      "Anyone on the project can read it. Every change — attaching, editing, deleting, highlighting, transferring, marking refunded — needs invoice rights; without them only “PDF” is left.",
    webOnlyNote:
      "The web app prints an invoice through a dedicated print page; the phone builds the PDF locally and hands it to the usual share sheet.",
  },
  {
    id: "billing",
    title: "Quotes and invoices for your clients",
    purpose:
      "The documents your company issues to its own clients — quotes (devis) and invoices (factures) — with reusable templates and a tracker for expenses awaiting reimbursement.",
    steps: [
      "Open Menu → “Quotes & invoices” and switch between “Quotes” and “Invoices”. Search by number or recipient and filter by status.",
      "Tap “New” and choose “Blank”, “From existing” (copies everything but the dates) or “From template”.",
      "Fill in the issuing company, the project, the recipient block, the dates, the lines and the totals, then tap “Create”.",
      "On a document, move its status along — sent, accepted, paid, cancelled — and export it as PDF or XLSX.",
      "“Duplicate” copies a document; an accepted quote can be turned into an invoice with “Convert to invoice”.",
      "“Templates” holds your quote and invoice templates; “Use” spawns a document from one.",
      "“Refundable expenses” tracks project expenses awaiting reimbursement: add them, set their status, and say whether the company, the bank or both refunded them.",
    ],
    whoCanDoIt:
      "Company administrators only. Everyone else does not see the Menu row at all.",
    webOnlyNote:
      "The web app splits quotes and invoices into two separate sections; the phone keeps both behind one list.",
  },
  {
    id: "company-members",
    title: "Company members and permissions",
    purpose:
      "The company directory: who belongs, what role they hold, what extra permissions they were granted or denied, and how new people get in.",
    steps: [
      "Open Menu → “Company members”. If you administer several companies, pick one at the top.",
      "The company code sits at the top — create it, renew it, share it or revoke it from there.",
      "Tap “Add by phone” to add someone by number, with an optional name and a member or manager role.",
      "“Import from another company” copies people across from a company you also administer.",
      "In the member list, change a role inline, or open “Custom permissions” to grant or deny one specific permission, either company-wide or on a single project.",
      "“Pending profiles” lists people you added by phone who have not signed in yet.",
    ],
    whoCanDoIt:
      "Company administrators. Members whose role is already administrator do not get a custom-permissions panel.",
    webOnlyNote:
      "The web app keeps the same directory under Settings → Company.",
    gotchas: [
      "Two ways in coexist: the reusable company code anyone can type, and a single-use invite token that expires after seven days.",
    ],
  },
  {
    id: "project-members",
    title: "Who works on this project",
    purpose:
      "Assign people who are already in the company to this site, and give them a role on it.",
    steps: [
      "Open Menu → Members, then tap “Assign a member”.",
      "Choose the person from the company members and pick their role, then tap “Assign”.",
      "The list shows everyone assigned, their role and when they joined.",
      "Tap “Remove” on a row to take someone off the site, after a confirmation.",
      "Old email invitations still appear under “Pending invitations” with their expiry and a “Revoke” button.",
    ],
    whoCanDoIt:
      "People who can manage users or invite on the project. You cannot remove yourself.",
    gotchas: [
      "New people are added to the company first, by phone, from the company members screen — you cannot create an email invitation here.",
      "Company administrators are implicit on every project of their company and are never listed.",
    ],
  },
  {
    id: "library",
    title: "The product library",
    purpose:
      "A catalogue of the products the company buys, with their suppliers, prices and purchase history, reusable when you price a job.",
    steps: [
      "Open Menu → “Product Library”. Search by name, and filter by supplier or category.",
      "Tap “Add product” and fill in the name — required — plus supplier, reference, category, size, description, URL and an image.",
      "Tap “Compare”, pick several products, then “Compare” again to see them side by side.",
      "Tap a product for its detail: supplier, reference, how many times it was bought, its last unit price and the purchase history.",
      "Deleting a product warns how many purchase records it carries and asks you to type its name.",
      "“Import purchases” takes a Leroy Merlin export, as a file or pasted, and reports what it created, updated and skipped.",
    ],
    whoCanDoIt:
      "Everyone who can open the Menu reaches the library. The server decides whether your changes are accepted and tells you if they are not.",
    gotchas: [
      "The product and supplier counts on the Menu row come from your first company, which may not be the one this site belongs to.",
    ],
  },
  {
    id: "chiffrage",
    title: "Pricing materials",
    purpose:
      "Price the materials for the job: sections, then articles per room, then a price per shop, with a basket and a running total for each shop.",
    steps: [
      "Open Menu → Chiffrage and build the frame with “Add poste”, “Add shop”, “Add room” and “Add unit”.",
      "Inside a section, tap “Add article” and give it a name, quantity, unit and room — or use “Pick from the library” to pull in a product you already have.",
      "On an article, tap “Add price” and enter the unit price excluding VAT, the VAT rate, the shop, the supplier and a product URL.",
      "Attach a picture by taking a photo or giving an image URL.",
      "Read the totals excluding and including VAT, and the count of articles still without a price.",
      "A shop basket says “covers everything” when it can supply every article.",
    ],
    whoCanDoIt:
      "Any project member who can open the Menu. The server decides whether your changes are accepted.",
  },
  {
    id: "documents",
    title: "Project documents",
    purpose:
      "The site's file drawer — plans, permits, contracts — with tags, filters and sorting.",
    steps: [
      "Open Menu → Documents. Filter by kind, uploader or tag, and sort by date, name, size or uploader.",
      "Tap “Add a document” and take a photo, pick from your library, or choose a file.",
      "Tap “Edit” on a row to rename the file or set comma-separated tags.",
      "Tap “Delete” to remove a document, after a confirmation.",
    ],
    whoCanDoIt:
      "Project managers only, reading included. Without those rights the section is not even listed in the Menu.",
  },
  {
    id: "photos",
    title: "Site photos",
    purpose:
      "The photo gallery of the site, videos included, each with an optional caption.",
    steps: [
      "Open Menu → Photos, then tap “Add photos” to take one or pick from your library.",
      "Tap a photo to open it, write a caption and tap “Save”.",
      "“Share” hands the file to the phone; videos have to be opened that way.",
      "“Delete” removes a photo after a confirmation.",
      "“Load more” pages through the gallery.",
    ],
    whoCanDoIt:
      "Anyone on the project can look. Adding, captioning and deleting need project-editing rights.",
  },
  {
    id: "notes",
    title: "Site notes and reminders",
    purpose:
      "Dated notes about the site — inspections, deliveries, decisions, calls. A note with a due date turns into a reminder in the bell.",
    steps: [
      "Open Menu → Notes. Filter by category or search.",
      "Add a note: a title is required, then details and a category — inspection, delivery, payment, decision, call or general.",
      "Tap a note to edit it.",
      "Use “Mark done” or “Reopen” on a note, or “Delete” to remove it.",
    ],
    whoCanDoIt:
      "Anyone on the project can read. Every change needs project-editing rights.",
    gotchas: [
      "Dismissing a reminder in the bell only hides it there; the note itself stays.",
    ],
  },
  {
    id: "analyses",
    title: "Analysis reports",
    purpose:
      "Keep HTML analysis reports against the site, searchable and tagged.",
    steps: [
      "Open Menu → Analyses. Search, or filter by tag.",
      "Tap the add control, choose the HTML report — required — then give it a title, a summary, a source URL and tags.",
      "Tap a row to read the report.",
      "“Edit” reopens the details; “Delete” removes the analysis after a confirmation.",
    ],
    whoCanDoIt:
      "Anyone on the project can read. Every change needs project-editing rights.",
  },
  {
    id: "chat",
    title: "Team chat",
    purpose:
      "Text and photo conversation with your company and your project team, one channel per company and per site.",
    steps: [
      "Tap the round message button at the bottom right of a project tab.",
      "Pick a channel from the chips along the top; a dot marks unread ones.",
      "Type your message and send it.",
      "Attach a picture with + to pick one, or the camera button to take one.",
      "Avatars under the newest message show who has read that far.",
    ],
    whoCanDoIt:
      "Everyone. Which channels you see follows your company access and the projects you are on.",
    webOnlyNote:
      "The web app carries the same team chat, behind a button in the corner of the screen, so a conversation continues across both.",
    gotchas: [
      "Messages arrive by polling, every few seconds, rather than instantly.",
      "The button hides itself while a panel is open and on screens that are not one of the four tabs.",
    ],
  },
  {
    id: "notifications",
    title: "The bell",
    purpose:
      "One place for everything waiting on you: attendance to approve, new company members to place, and notes whose due date has arrived.",
    steps: [
      "Tap the bell in the top bar. A dot appears whenever something is waiting.",
      "The first block is attendance to validate — see the topic on approving days.",
      "The second lists new company members not yet assigned to a site; tap one to go and place them.",
      "The third lists reminders, each with its category and due date; tap it to open the note, or “Dismiss” to clear it.",
      "When nothing is due the sheet simply says so.",
    ],
    whoCanDoIt:
      "Everyone sees the bell; what it contains depends on you. Attendance goes to the people who manage it, new members to company administrators.",
    gotchas: [
      "New members are not counted in the dot yet, so the dot can under-count.",
      "This is the approvals bell. Which pushes reach your phone is a separate screen, in Settings → Notifications.",
    ],
  },
  {
    id: "settings",
    title: "Settings, payment methods and roles",
    purpose:
      "Your account, your companies and the lists the rest of the app draws on: payment methods, labor roles and which notifications reach this phone.",
    steps: [
      "Tap your initials, then “Settings”.",
      "“Payment methods” names the ways invoices get paid for a company. Type a name and tap “Add”; tap one to rename it. Cash is built in and cannot be removed.",
      "“Labor roles” holds the roles you attach to workers, each with a colour. Tap “New role”, name it, pick a colour and save.",
      "“Notifications” chooses which pushes reach this phone: a master switch, then team chat, attendance, tasks, team and access, and money.",
      "“My companies” lists the companies you belong to. Administrators can edit the legal details, hand out join codes and invite tokens, manage attached users and delete the company.",
      "“Merge persons” collapses a duplicate person into the right one and moves their workers across.",
      "The bottom of the screen carries the app version and “Sign out”.",
    ],
    whoCanDoIt:
      "Everyone reaches Settings. Changing payment methods needs company administration. Notification choices are personal to this phone.",
    gotchas: [
      "The counts and the company name on the settings rows come from your first company, not from the site you have selected.",
      "Removing a payment method leaves existing invoices untouched; it only stops new ones using it.",
    ],
  },
  {
    id: "worker-attendance",
    title: "Declaring the days you worked",
    purpose:
      "As a worker, you declare the days you were on site and watch for your manager to approve them.",
    steps: [
      "Pick the day you are declaring — the calendar sits below the log card.",
      "Choose your shift: full day, half day or overtime.",
      "Tap “Log this day”. It is sent straight away, and your manager is told it is waiting for them.",
      "On a day you already declared, tap “Edit this day” to change the shift, the extra hours or the note.",
      "While it is still pending your change is saved directly; once it has been validated the same button sends a change request instead.",
      "The badges tell you where each day stands: pending, validated, or a change requested with what you asked for.",
      "Lower down: your days, what you earned and what is still pending for the month, plus who else is on site that day.",
    ],
    whoCanDoIt:
      "You, on the site you have selected, provided your account is linked to a worker record. If it is not, the screen tells you to ask your manager.",
    workerMode: true,
    gotchas: [
      "You can declare today or an earlier day that has no entry yet; a future day is refused.",
      "The team list shows names, presence and hours, never anyone's pay, unless you are allowed to see pay.",
    ],
  },
  {
    id: "worker-salary",
    title: "Your pay on this site",
    purpose:
      "What you earned on this site, what has been paid, and what is still outstanding, month by month.",
    steps: [
      "Open the Salary tab.",
      "Read the totals: earned, paid and outstanding.",
      "Each month card shows its status, the days worked, and what was earned, paid and still remaining.",
      "The payments you received are listed under each month.",
    ],
    whoCanDoIt:
      "You, read-only. Only an administrator or a manager can change whether a month counts as paid.",
    workerMode: true,
  },
  {
    id: "worker-profile",
    title: "Your profile and daily rate",
    purpose:
      "Who you are on this site and how your daily rate has changed over time.",
    steps: [
      "Open the Profile tab.",
      "Read your name, your role, your phone number and the site you are on.",
      "“Daily rate today” is what each worked day currently earns you.",
      "“Rate history” lists your starting rate and every change since, saying which have taken effect and which are still to come, with the increase or decrease each time.",
    ],
    whoCanDoIt:
      "You, read-only. Changing a rate needs attendance-management rights, which is exactly what this view does not have.",
    workerMode: true,
  },
];
