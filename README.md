# Dil Ki Adalat — Aadi & Geet

A responsive romantic keepsake website with:
- Public chapter archive and individual chapter pages
- A private admin studio for adding/editing messages and replies
- Draft/publish workflow
- Firebase Authentication and Firestore
- GitHub Pages hosting

## Cost plan

- GitHub Pages: free for a public repository.
- Firebase Spark plan: free usage quotas, suitable for a small personal project.
- No paid domain required.
- No paid template or website builder.

Free service quotas and plan terms can change. Keep Firebase on the Spark plan and do not enable billing if your requirement is strictly zero spend.

## Important security model

The admin page being at `/admin.html` is not the security boundary. Firebase Authentication and Firestore Security Rules enforce permissions. Public visitors can read published chapters only; only the UID configured in `firestore.rules` can read drafts and write/delete records.

Never add a Firebase service-account key or any private server credential to this repository. Firebase web config is intended to be present in client code; the security rules protect the database.

## Setup

### 1. Create a Firebase project
1. Open https://console.firebase.google.com/
2. Create a project. Analytics can be disabled.
3. Add a Web App to the project.
4. Copy the web app config into `firebase-config.js`.
5. Open Authentication → Sign-in method and enable **Email/Password**.
6. Open Authentication → Users and create your own admin user with your email and a strong password.
7. Copy the admin user's **UID** from the Users screen.

### 2. Create Firestore
1. Open Firestore Database and create the database.
2. Start in production mode.
3. Open the Rules tab.
4. In `firestore.rules`, replace `REPLACE_WITH_YOUR_FIREBASE_AUTH_UID` with the UID of your admin user.
5. Publish those rules in Firebase.

Do not leave the placeholder UID in the rules. If you do, no account will be able to write content.

### 3. Configure the website
Edit `firebase-config.js` and replace all placeholders with the Firebase Web App configuration from Project settings → General → Your apps.

The config is not a secret; the Firestore rules and admin authentication are the security boundary.

### 4. Test locally (optional)
Because Firebase config and browser modules need to be served over HTTP, use a local server instead of opening the HTML file directly. For example, if Python is installed:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000`.

### 5. Publish on GitHub Pages
1. Create a **public** GitHub repository, for example `dil-ki-adalat`.
2. Upload the contents of this project to the repository root (not the enclosing ZIP folder).
3. In the repository, open Settings → Pages.
4. Under Build and deployment, choose **Deploy from a branch**.
5. Select the `main` branch and `/ (root)`, then Save.
6. Wait for GitHub Pages to publish and open the URL shown in Settings → Pages.

A public repository is required for the standard free GitHub Pages plan. Do not store sensitive private information in the repository. Your actual messages and replies are stored in Firestore, not in the GitHub repository.

### 6. Use the admin studio
Visit `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/admin.html`.
Log in with the Firebase admin account you created. Add the original message, quality, title, court question, your reply, final observation and next hearing. Leave “Publish this chapter” unchecked to save a draft; check it and save to make it visible on the public website.

The site automatically reads published content from Firestore. You do not need to redeploy the website for each new chapter.

## Content notes
- Paste Geet's original message exactly as received.
- Use the Day number to preserve the sequence (for example 30 down to 9).
- The public archive sorts chapters from highest day number to lowest.
- Keep personal responses in the admin panel/database, not in source files.

## Before launch
- Replace all Firebase config placeholders.
- Replace the admin UID in Firestore rules and publish the rules.
- Test that a logged-out visitor can read published chapters but cannot read drafts or write.
- Test that the admin account can create, edit, publish, unpublish, and delete chapters.
- Test the site on mobile and desktop.
