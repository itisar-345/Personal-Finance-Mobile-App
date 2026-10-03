/**
 * Business details and the text of every legal document shown in the app. One source of truth:
 * the About sheet, the onboarding consent step and the Legal section in Settings all read from here.
 *
 * Bump LEGAL_VERSION whenever the Terms or Privacy Policy change materially; users who accepted an
 * older version are asked to review and accept again on their next launch.
 */

// TODO(before release): replace any remaining bracketed placeholder with your real details.
export const BUSINESS = {
  appName: 'FinTrack',
  developer: 'RAX Venture',
  email: 'rax.venture@gmail.com',
  address: '[Registered postal address]',
  jurisdiction: 'India',
  version: '1.0.0',
};

export const LEGAL_VERSION = '2026-09-29';
const UPDATED = 'September 29, 2026';

export type LegalDocId = 'privacy' | 'terms' | 'refund' | 'cookies' | 'licenses';

export interface LegalDoc {
  title: string;
  updated?: string;
  sections: { heading?: string; body: string[] }[];
}

// Omit the address line entirely while it's still a bracketed placeholder, rather than showing
// literal "[Registered postal address]" text to real users.
const hasAddress = !BUSINESS.address.startsWith('[');
const contact = `${BUSINESS.developer}${hasAddress ? `, ${BUSINESS.address}` : ''}. Email: ${BUSINESS.email}`;

export const LEGAL_DOCS: Record<LegalDocId, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    updated: UPDATED,
    sections: [
      {
        body: [
          `${BUSINESS.appName} is provided by ${BUSINESS.developer} ("we", "us"). This policy explains what information the app handles and what happens to it.`,
          'In short: FinTrack has no accounts, no servers, no analytics, no advertising and no tracking. Everything you enter stays on your device. We never receive it.',
        ],
      },
      {
        heading: 'What the app stores on your device',
        body: [
          'Financial entries you type in: transactions, categories, assets, investments, debts, contributions and goals.',
          'Your profile inputs: your age (used only to suggest an investment allocation band) and an expected annual return (used only for goal projections). You can change or clear them later in Settings.',
          'App settings such as theme, currency and exchange rates you enter, reminder and backup preferences, and the date you accepted these terms.',
          'If you set an app PIN: a salted hash of the PIN, kept in your operating system\'s secure keystore. The PIN itself is never stored.',
        ],
      },
      {
        heading: 'What we do not collect',
        body: [
          'We do not collect your name, email, phone number, contacts, location, device identifiers or advertising ID. The app contains no analytics, crash-reporting, advertising or social SDKs, and it makes no network requests of its own.',
        ],
      },
      {
        heading: 'Permissions',
        body: [
          'Notifications (optional): requested only when you turn on due-date reminders. Reminders are scheduled locally on your device. On Android their content is hidden on a secure lock screen.',
          'Files (on demand): the system file picker opens only when you choose to restore a backup, and the app reads only the file you pick. The share sheet opens only when you export.',
          'Android system backup is disabled for FinTrack, so your data is not copied to cloud device backups.',
        ],
      },
      {
        heading: 'Exports and backups you create',
        body: [
          'When you export a JSON backup or CSV file, it goes wherever you send it (for example a cloud drive or email). The privacy policy of that service then applies. Exported files are not encrypted by FinTrack, so store them somewhere safe.',
        ],
      },
      {
        heading: 'Children',
        body: [
          'FinTrack is intended only for people aged 18 and over and is not directed at children. The app asks you to confirm you are 18 or older before use. We do not knowingly process information about children. If a child has used the app, the data can be removed at any time with Settings → Delete All Data.',
        ],
      },
      {
        heading: 'Keeping and deleting your data',
        body: [
          'Your data stays on your device until you delete it. Settings → Delete All Data permanently erases the data file, its previous-save and recovery copies, temporary export and import files, your PIN and any scheduled reminders. Uninstalling the app also removes it.',
          'Because we never hold a copy of your data, there is nothing for us to delete on our side. You can still contact us with any privacy request and we will answer it.',
        ],
      },
      {
        heading: 'Your rights',
        body: [
          'Depending on where you live (for example under the GDPR or India\'s DPDP Act) you have rights to access, correct, port and erase your personal data. In FinTrack you exercise them directly: view and edit everything in the app, export it as JSON or CSV, and erase it with Delete All Data.',
        ],
      },
      {
        heading: 'Security',
        body: [
          'Data is stored in the app\'s private storage and protected by your device\'s own encryption and screen lock. The optional PIN adds a lock screen inside the app. The data file itself is not separately encrypted by FinTrack.',
        ],
      },
      {
        heading: 'Changes and contact',
        body: [
          'If we change this policy materially we will update the date above and ask you to review it in the app before continuing.',
          `Contact: ${contact}`,
        ],
      },
    ],
  },

  terms: {
    title: 'Terms of Service',
    updated: UPDATED,
    sections: [
      {
        heading: 'Agreement',
        body: [
          `These terms are an agreement between you and ${BUSINESS.developer} for your use of ${BUSINESS.appName}. By using the app you accept them. If you do not agree, do not use the app.`,
        ],
      },
      {
        heading: 'Eligibility',
        body: ['You must be at least 18 years old to use FinTrack.'],
      },
      {
        heading: 'Price',
        body: [
          'FinTrack is free. There are no purchases, subscriptions, advertisements, in-app payments or hidden fees. If paid features are ever introduced, the price will be shown clearly before any charge and nothing will be charged without your explicit agreement.',
        ],
      },
      {
        heading: 'Not financial advice',
        body: [
          'Allocation bands, health ratios, projections, goal plans and debt payoff orders are general, illustrative estimates calculated from the numbers and assumptions you enter. They are not investment, tax, legal or financial advice and do not account for your full circumstances. Actual returns vary and can be negative. Consider speaking to a qualified adviser before making financial decisions.',
        ],
      },
      {
        heading: 'Your data and backups',
        body: [
          'Your data is stored only on your device. We cannot see, restore or recover it. You are responsible for exporting backups if you want to keep a copy.',
          'Figures are only as accurate as what you enter. Exchange rates are entered by you and are not live market rates.',
        ],
      },
      {
        heading: 'Licence and acceptable use',
        body: [
          'We grant you a personal, non-exclusive, non-transferable licence to use the app. Do not use it for anything unlawful, or reverse engineer or redistribute it except as the law or an applicable open-source licence allows. Open-source components are licensed under their own terms (see Open-source licences).',
        ],
      },
      {
        heading: 'Disclaimer and liability',
        body: [
          'The app is provided "as is" and "as available", without warranties of any kind to the extent permitted by law. To the extent permitted by law we are not liable for indirect or consequential losses, or for losses from decisions made using the app\'s estimates or from lost data.',
          'Nothing in these terms limits any rights you have as a consumer that cannot be excluded by law.',
        ],
      },
      {
        heading: 'Ending use, changes, law',
        body: [
          'You can stop using the app at any time and delete your data with Settings → Delete All Data.',
          'We may update these terms. If a change is material, the app will ask you to review and accept it before continuing.',
          `These terms are governed by the laws of ${BUSINESS.jurisdiction}.`,
          `Contact: ${contact}`,
        ],
      },
    ],
  },

  refund: {
    title: 'Refund Policy',
    updated: UPDATED,
    sections: [
      {
        body: [
          'FinTrack is free to download and use. It has no purchases, subscriptions or in-app payments, so there is nothing to refund.',
          'If you were ever charged for something claiming to be FinTrack, contact us and the store you paid through. App store purchases are refunded under that store\'s own refund process.',
          'If paid features are introduced in future, this policy will be updated with clear refund terms before any charge is possible. Your statutory consumer rights are not affected.',
          `Contact: ${contact}`,
        ],
      },
    ],
  },

  cookies: {
    title: 'Cookie Policy',
    updated: UPDATED,
    sections: [
      {
        heading: 'Mobile app',
        body: ['The FinTrack mobile app does not use cookies, tracking pixels or similar technologies.'],
      },
      {
        heading: 'Web version',
        body: [
          'The web version sets no cookies and loads no third-party or tracking scripts.',
          'It uses your browser\'s local storage only for things the app cannot work without: the data you enter, your PIN hash if you set one, and a note that you have seen the storage notice. This is strictly necessary storage, so it does not require consent, but we tell you about it anyway.',
          'You can remove it at any time with Settings → Delete All Data, or by clearing site data in your browser.',
        ],
      },
      {
        heading: 'Contact',
        body: [contact],
      },
    ],
  },

  licenses: {
    title: 'Open-source Licences',
    sections: [
      {
        body: [
          'FinTrack uses only your device\'s system fonts and bundles no third-party fonts, photos or illustrations. Icons are from Lucide (ISC licence). The app is built on the open-source packages below.',
        ],
      },
      {
        heading: 'MIT licence',
        body: [
          'expo, expo-router, expo-constants, expo-crypto, expo-document-picker, expo-file-system, expo-font, expo-notifications, expo-secure-store, expo-sharing, expo-splash-screen, expo-status-bar, expo-system-ui, react, react-dom, react-native, react-native-web, react-native-svg, react-native-screens, react-native-safe-area-context, react-native-gesture-handler, react-native-reanimated, @react-navigation/native, @react-navigation/bottom-tabs.',
          'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
          'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
          'Copyright © the respective authors of each package (Meta Platforms, Inc. and affiliates; 650 Industries, Inc. (Expo); Software Mansion; React Navigation contributors; Nicolas Gallagher; and others).',
        ],
      },
      {
        heading: 'ISC licence',
        body: [
          'lucide-react-native. Copyright © Lucide Contributors (portions © Cole Bemis, Feather).',
          'Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS.',
        ],
      },
    ],
  },
};
