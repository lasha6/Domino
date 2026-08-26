# Google-ით შესვლის ჩართვა

თამაში **უკვე მუშაობს** — სტუმრად შესვლა ყოველთვის ხელმისაწვდომია და არაფერს
საჭიროებს. Google-ის ღილაკი კი მანამ **არ ჩანს**, სანამ ქვემოთ ჩამოწერილ ერთ
გასაღებს არ დააყენებ. ეს ერთხელ კეთდება, ~5 წუთი.

გასაღები საიდუმლო არაა (ბრაუზერშიც ჩანს), მაგრამ კოდში მაინც არ იდება —
სერვერს ვეუბნებით, ის კი აპსაც და საიტსაც თვითონ გადასცემს. ამიტომ შეცვლისას
**აპის თავიდან აწყობა არ დაგჭირდება**.

## 1. გასაღების აღება (Google Cloud Console)

1. გახსენი **https://console.cloud.google.com/** და შედი შენი Google ანგარიშით.
2. ზემოთ, პროექტების სიაში — **New Project**. სახელი: `Domino`. → **Create**.
3. მარცხენა მენიუში: **APIs & Services → OAuth consent screen**.
   - User Type: **External** → **Create**
   - App name: `დომინო`, User support email: შენი ფოსტა, Developer contact: შენი ფოსტა
   - **Save and Continue** სამჯერ, ბოლოს **Back to Dashboard**
4. **APIs & Services → Credentials → + Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Name: `Domino web`
   - **Authorized JavaScript origins** — დაამატე ეს სამი:
     ```
     https://domino-z4zg.onrender.com
     http://localhost:3000
     https://localhost
     ```
   - **Create**
5. გამოჩნდება **Client ID** — გრძელი სტრიქონი, რომელიც `...apps.googleusercontent.com`-ით
   მთავრდება. დააკოპირე.

## 2. სერვერზე დაყენება (Render)

1. გახსენი **https://dashboard.render.com/** → შენი სერვისი `domino`.
2. მარცხნივ **Environment** → **Add Environment Variable**
   - Key: `GOOGLE_CLIENT_ID`
   - Value: (ჩასვი დაკოპირებული Client ID)
3. **Save Changes** — Render თვითონ გადატვირთავს (~1 წუთი).

მერე გახსენი **https://domino-z4zg.onrender.com** → პროფილზე დააჭირე →
Google-ის ღილაკი უკვე იქ იქნება.

**შესამოწმებლად:** გახსენი `https://domino-z4zg.onrender.com/auth/config` —
თუ `"google": true` წერია, ჩართულია.

## თუ ღილაკი არ ჩანს

**აპში არ ჩანს, ბრაუზერში კი ჩანს** — აპის გვერდები APK-შია და სერვერისთვის
სხვა მისამართიდან მოდის (`https://localhost`). ორივე მხარემ უნდა დაუშვას:

1. **სერვერმა.** შეამოწმე:
   ```
   curl -H "Origin: https://localhost" https://domino-z4zg.onrender.com/auth/config
   ```
   თუ `"google": true` დაბრუნდა — სერვერი წესრიგშია.
2. **Google-მა.** Google Cloud Console → Credentials → შენი OAuth client →
   **Authorized JavaScript origins** — იქ **`https://localhost`** უნდა ეწეროს
   (ზემოთ, მე-4 ნაბიჯში სამივე მისამართია ჩამოთვლილი).

> ცვლილება Google-ის მხარეს რამდენიმე წუთში ეშვება.

**არსად არ ჩანს** — `GOOGLE_CLIENT_ID` არ არის დაყენებული Render-ზე.
შეამოწმე: `https://domino-z4zg.onrender.com/auth/config` → `"google": false`.

**ჩანს, მაგრამ შესვლის შემდეგ "სტუმრად თამაშობ" წერია** — ტოკენს ერთი საათი
აქვს ვადა. თამაში აგრძელებს (პროგრესი არ იკარგება), მაგრამ ✓ ნიშნისთვის
საჭიროა თავიდან შესვლა.

## ლოკალურად გასაშვებად (არასავალდებულო)

```bash
set GOOGLE_CLIENT_ID=შენი-client-id
npm start
```

## რა შეიცვლება

- **სტუმარი** — ყველაფერი ისევე, როგორც აქამდე. სახელს თვითონ წერს.
- **Google-ით შესული** — სახელს Google ადასტურებს, ამიტომ მაგიდაზე მის სახელს
  გვერდით მწვანე ✓ უჩნდება. სხვას იმავე სახელით შემოსვლა ვეღარ დაეხმარება.

**მონეტები ჯერ კიდევ ტელეფონშია** — ანგარიშზე გადასატანად ბაზა გვჭირდება
(სად შევინახოთ). ეს ცალკე ნაბიჯია.

## ცნობილი შეზღუდვა — აპში

Google მიზანმიმართულად ზღუდავს შესვლას "ჩაშენებულ" ბრაუზერებში, ხოლო Capacitor
სწორედ ასეთს იყენებს. ამიტომ **APK-ში Google-ის ღილაკმა შეიძლება არ იმუშაოს** —
ამ შემთხვევაში მოთამაშე ხედავს შეტყობინებას და სტუმრად შედის, თამაში არ ფუჭდება.
საიტზე ყველაფერი რიგზეა.

აპში სრულფასოვნად რომ იმუშაოს, ცალკე მოდული სჭირდება (Google-ის ნატიური შესვლა
Android-ისთვის) — ეს შემდეგი ნაბიჯია, როცა გადავწყვეტთ, რომ ღირს.

## ხატულადან შესვლა (Authorized redirect URI) — ერთხელ

**ხატულადან გახსნილ აპში Google-ის ჩვეულებრივი ღილაკი არ მუშაობს.** ის
popup-ს ხსნის, popup კი იქიდან **ბრაუზერს** გადაეცემა — სხვა ფანჯარა, სხვა
საცავი, და აპი პასუხს ვეღარ კითხულობს. მოთამაშე Google-ში გადაიგდება და
შესული აღარ ბრუნდება.

ამიტომ ხატულადან **redirect** გამოიყენება: Google ტოკენს ჩვეულებრივი ფორმით
გვიგზავნის, ეს კი იმავე ფანჯარაში რჩება. **მაგრამ Google-მა უნდა იცოდეს,
სად მოგვწეროს** — და ეს მხოლოდ შენ შეგიძლია დაამატო:

1. https://console.cloud.google.com/apis/credentials → შენი **OAuth 2.0 Client ID**
2. **Authorized redirect URIs** → **ADD URI**:
   ```
   https://domino-z4zg.onrender.com/auth/google
   ```
3. **SAVE** (ცვლილება რამდენიმე წუთში ამოქმედდება)

ამის გარეშე ხატულადან შესვლა `redirect_uri_mismatch`-ით ჩავარდება.
ბრაუზერის ტაბში შესვლა ისედაც მუშაობს და ამას არ ეხება.

**Android-ის APK ცალკე საკითხია.** იქ გვერდები `https://localhost`-იდან
მოდის, ესე იგი redirect ჩვენს საიტზე დაბრუნდება და არა აპში. WebView-ში
Google OAuth-ს ისედაც ბლოკავს. სწორი გამოსავალი **native plugin**-ია
(`@codetrix-studio/capacitor-google-auth` ან მსგავსი) — ცალკე სამუშაოა.
