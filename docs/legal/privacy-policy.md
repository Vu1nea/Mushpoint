# Mushpoint privacy policy

> **DRAFT, not yet in force.** Written from what the code actually does (November 2026) so a
> reviewer can check it against the product. Fill in every `[bracketed]` item and have it
> reviewed by someone qualified in UK data protection law before publishing it. Re-check it
> whenever data handling changes (new fields, analytics, error tracking, a new processor).

Last updated: [date]

Mushpoint is a goal, task, habit-streak and vision-board tracker run by [operator name]
("we"). This policy explains what personal data Mushpoint holds, why, who else handles it, how
long it is kept, and your rights. Contact: [contact email].

We are the controller of your data under the UK General Data Protection Regulation (UK GDPR) and
the Data Protection Act 2018.

## What we hold

**Account details.** Your email address and a hashed password, held by our authentication
provider, Supabase. We never see your password.

**Profile.** The username you choose and, if you upload one, a profile picture.

**What you put into the app.** Categories, goals and subgoals (titles, descriptions, due dates,
motivation text and images, repository links), tasks and their status and repeat schedule, the
days you tick a habit, ideas and their tags, vision board items (images and quotes), and your
settings (theme, streak grace days).

**Your time zone.** Your browser sends its time zone name (for example `Europe/London`) with
each request so streaks follow your local days. It is used for that request only and not stored.

**Technical logs.** For each request our server logs the time, the method and path (without
query strings), the response status, how long it took, a request id and your account id. It does
not log your IP address, request contents, or authentication tokens. [Retention: state how long
logs are kept by the hosting setup.]

We do not use analytics, advertising, or tracking cookies, and we do not sell or share your data
for marketing.

## Why we hold it (lawful basis)

To provide the service you signed up for, the contract basis (UK GDPR Article 6(1)(b)):
everything above except the logs. To keep the service secure and working, our legitimate
interests (Article 6(1)(f)): the technical logs and rate limiting.

## Storage on your device

Mushpoint does not set cookies. It stores these in your browser's local storage:

| Item | Why |
| --- | --- |
| `sb-<project>-auth-token` | Your sign-in session, kept by Supabase so you stay signed in. Removed when you sign out. |
| The theme you picked | So the app opens in your theme before it has loaded your settings. |
| Whether the sidebar is collapsed, and your preferred task and goal views | So the screens look as you left them. |

These are needed for features you ask for, so they do not need consent under the Privacy and
Electronic Communications Regulations. [Reviewer: confirm.]

## Who else handles your data

| Who | What for | Where |
| --- | --- | --- |
| Supabase, Inc. | Sign-in, the database, and image storage | [region of the Supabase project]. Transfers outside the UK rely on [the UK International Data Transfer Addendum / adequacy, as applicable]. |
| [Hosting provider] | Runs the Mushpoint server and website | [region] |

Images are stored privately. When you upload one, we resize it and remove its embedded metadata,
such as the camera details and the location a photo was taken. The app shows images through links
that expire after a short time.

## How long we keep it

Until you delete your account. Deleting it (Settings, Delete account) removes your profile,
everything you created, your uploaded images, and your sign-in account. We keep only a record of
your account id and the deletion time, so a sign-in token issued before the deletion cannot
recreate data. [Backups: state how long database backups keep deleted data before it ages out.]

## Your rights

You can ask to access, correct, delete, restrict or object to the use of your data, and to
receive it in a portable format. Most of this you can do yourself:

- **Copy of your data:** Settings, Your data, Download my data. You get a JSON file with every
  record we hold for your account and links to your images that work for 24 hours.
- **Correct:** edit anything in the app; change your email or password in Settings.
- **Delete:** Settings, Delete account.

For anything else, email [contact email]. We reply within one month. If you are unhappy with how
we handle your data, you can complain to the Information Commissioner's Office (ico.org.uk).

## Children

Mushpoint is not meant for children under 13, and we do not knowingly hold their data.

## Changes

We will update this page and the date above when this policy changes, and tell signed-in users
about significant changes in the app.
