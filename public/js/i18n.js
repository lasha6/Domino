/* =====================================================================
   Two languages.

   The app was written in Georgian, and Georgian stays the source: every string
   in every screen is still written there, and this file says what each one is
   in English. Nothing was renamed into keys — the Georgian IS the key — so a
   string with no entry here simply stays Georgian rather than turning into
   "menu.title.label" in front of a player.

   It works on the page rather than in the screens: the text is translated
   where it lands, and a watcher does the same to anything drawn later. That is
   why none of the seven screens had to be rewritten to hold two languages, and
   why a new screen is bilingual the moment it loads this file.

   English is a second language here, not a replacement: numbers, card ranks and
   anything not written in Georgian letters are left exactly as they are.
   ===================================================================== */
(function (global) {
  "use strict";

  const KA = /[ა-ჿ]/;
  const STORE = "dominoLang";

  /* ---------------- what each string is in English ---------------- */
  const EN = {
    // --- the games, and the front page ---
    "დომინო": "Domino", "ბურა": "Bura", "ჯოკერი": "Joker",
    "აირჩიე თამაში": "Choose a game",
    "ქართული წესებით": "Georgian rules",
    "3 და 5 კარტა": "3 and 5 card",
    "24 ხელი · 4 მოთამაშე": "24 hands · 4 players",
    "ონლაინ": "Online",
    "ითამაშე": "Play",
    "👥 მეგობართან": "👥 With a friend",
    "🤖 კომპიუტერთან": "🤖 Against the computer",
    "← თამაშები": "← Games",
    "მალე": "Soon",

    // --- rooms and tables ---
    "აირჩიე ოთახი": "Choose a table",
    "ბლიც": "Blitz", "სწრაფი": "Quick", "კლასიკური": "Classic", "ოსტატი": "Master",
    "რჩეული": "Popular",
    "მოგებულს ფსონი ემატება, წაგებულს აკლდება": "The winner takes the stake, the loser pays it",
    "🎓 კომპიუტერთან პრაქტიკაა — მონეტები არ ითვლება":
      "🎓 Practice against the computer — no coins at stake",
    "👤 1v1": "👤 1v1", "👥 2v2 წყვილებით": "👥 2v2 in pairs",
    "2v2 (წყვილებით)": "2v2 (in pairs)",
    "ხუთკარტა": "Five-card", "სამკარტა": "Three-card",
    "36 კარტი": "36 cards", "20 კარტი · „ვარ\"": "20 cards · \"var\"",
    "მალუტკა რიგის გარეშე": "Malutka out of turn",
    "ხუთკარტაში — ერთი ფერის სრული ხელი ნებისმიერ დროს":
      "Five-card: a whole hand of one suit, at any time",
    "მატჩი რამდენ ქულამდე?": "How many points to win?",
    "2v2 ონლაინშია": "2v2 is online only",
    "წყვილებით მხოლოდ ხუთკარტაა": "Pairs are five-card only",
    "დახურვა": "Close",

    // --- playing with a friend ---
    "მეგობართან თამაში": "Play with a friend",
    "შექმენი მაგიდა": "Make a table",
    "მიიღებ კოდს": "You get a code",
    "კოდით შესვლა": "Join by code",
    "მეგობრის მაგიდაზე": "At a friend's table",
    "მეგობრის კოდი გაქვს? ჩაწერე აქ:": "Got a friend's code? Type it here:",
    "კოდი": "Code", "შესვლა ▶": "Join ▶",
    "კოდი 4 სიმბოლოა": "A code is four characters",
    "მიიღებ კოდს და გაუზიარებ მეგობარს": "You get a code to share with a friend",
    "გაუზიარე კოდი მეგობარს": "Share the code with your friend",
    "გაუზიარე ეს კოდი": "Share this code",
    "მაგიდა შექმნილია": "Table made",
    "ვერ შევედი": "Could not join",
    "ასეთი მაგიდა ვერ მოიძებნა": "No such table",
    "მაგიდა უკვე სავსეა": "That table is already full",

    // --- waiting, dropping, coming back ---
    "ველოდებით…": "Waiting…",
    "მოწინააღმდეგეს ვეძებ": "Looking for an opponent",
    "ვეძებთ მოწინააღმდეგეს": "Looking for an opponent",
    "ვაგროვებთ მაგიდას": "Filling the table",
    "სერვერს ვუკავშირდები": "Connecting to the server",
    "სერვერს ვაღვიძებ… (ერთი წუთი)": "Waking the server… (about a minute)",
    "სერვერს ვაღვიძებ… ერთი წუთი დასჭირდება": "Waking the server… this takes about a minute",
    "ვუკავშირდები…": "Connecting…",
    "კავშირი გაწყდა": "Connection lost",
    "კავშირი გაწყდა — ვცდილობ…": "Connection lost — retrying…",
    "ვცდილობ ხელახლა დაკავშირებას — თამაში შენარჩუნებულია.":
      "Reconnecting — your game is being kept.",
    "თამაში შეჩერებულია": "Game paused",
    "ველოდებით მოთამაშეს…": "Waiting for a player…",
    "თამაში ვეღარ დავაბრუნე": "Could not get the game back",
    "მაგიდა დაიხურა.": "The table has closed.",
    "კავშირი დიდხანს იყო გაწყვეტილი და მაგიდა დაიხურა.":
      "The connection was gone too long and the table closed.",
    "მაგიდა შენ გელოდება": "A table is waiting for you",
    "დაბრუნება ▶": "Go back ▶",
    "— თამაში მიდის": "— in play",
    "— მაგიდა ველოდება": "— still filling",
    "მაგიდის დატოვება?": "Leave the table?",
    "თუ დარჩები, ადგილი შენია. თუ გახვალ, ადგილს დაკარგავ და მატჩი წაგებულად ჩაგეთვლება.":
      "Stay and the chair is yours. Leave and you give it up, and the match is lost.",
    "მაგიდიდან გასვლა?": "Leave the table?",
    "თამაში ჯერ არ დაწყებულა — ადგილს უბრალოდ დატოვებ.":
      "The game has not started — you would simply leave the chair.",
    "დავრჩები": "Stay", "გასვლა": "Leave", "გაუქმება": "Cancel",
    "მარტო დაველოდები": "Wait alone",
    "შენს წყვილს ელოდები?": "Waiting for your partner?",
    "მოწინააღმდეგე გავიდა": "Your opponent left",

    // --- the table, generally ---
    "მაგიდა": "Table", "მიზანი": "Target", "ხელი": "Hand", "ფასი": "Value",
    "ფსონი": "Stake", "ქულა": "Points", "სულ": "Total", "ჯამი": "Total",
    "სეტი": "Set", "ბიდი": "Bid", "კოზირი": "Trump", "ბაზარი": "Boneyard",
    "შენ": "You", "ჩვენ": "Us", "ისინი": "Them", "მოწ.": "Opp.", "კომპ.": "CPU",
    "მოთამაშე": "Player", "მოწინააღმდეგე": "Opponent",
    "კომპიუტერი": "Computer", "სტუმარი": "Guest",
    "შენი სვლა": "Your move", "შენი სვლაა": "Your move",
    "მოწინააღმდეგის სვლა": "Opponent's move",
    "კომპიუტერის სვლაა": "The computer's move",
    "მოწინააღმდეგე ფიქრობს": "Your opponent is thinking",
    "დასრულდა": "Finished",
    "ახალი თამაში": "New game", "ახალი მატჩი": "New match",
    "მთავარ ეკრანზე": "Back to the menu",
    "მენიუში დაბრუნება": "Back to the menu",
    "შემდეგი ხელი ▶": "Next hand ▶",
    "შემდეგი რაუნდი იწყება…": "The next round is starting…",
    "შემდეგი ხელი იწყება…": "The next hand is starting…",
    "მატჩი დასრულდა": "The match is over",
    "თამაში დასრულდა": "The game is over",
    "ხელი დასრულდა": "The hand is over",
    "გადააბრუნე მოწყობილობა": "Turn your device",
    "თამაში თარაზულ (landscape) რეჟიმში ითამაშება.": "This game is played in landscape.",
    "🎓 პრაქტიკა": "🎓 Practice",
    "ხმა": "Sound", "ხმა — ჩართული": "Sound — on", "ხმა — გამორთული": "Sound — off",
    "თამაშის წესები": "How to play",
    "როგორ ვთამაშობთ": "How we play",
    "ასე არ შეიძლება": "That move is not allowed",

    // --- domino ---
    "ქვა": "tile", "ქვები": "tiles", "ქვით": "tiles",
    "ბლოკი!": "Blocked!", "ბლოკი.": "Blocked.",
    "რიბა! 🔄": "Riba! 🔄", "რიბა": "riba", "რიბა.": "riba.",
    "შენ იწყებ": "You start", "კომპიუტერი იწყებს": "The computer starts",
    "შენ გახსენი": "You opened", "კომპიუტერმა გახსნა": "The computer opened",
    "შენ ჩამოხვედი": "You led",
    "ბაზარი — აიღე ქვა": "Boneyard — take a tile",
    "ბაზარი — კომპიუტერი იღებს": "Boneyard — the computer is drawing",
    "შენი სვლაა — აირჩიე ქვა": "Your move — pick a tile",
    "შენი სვლაა — აირჩიე ქვები": "Your move — pick your tiles",
    "ერთი ფერის ქვები აირჩიე": "Pick tiles of one suit",
    "შენ დაასრულე ხელი! 🎉": "You finished the hand! 🎉",
    "კომპიუტერმა დაასრულა ხელი": "The computer finished the hand",
    "შენ მოიგე მატჩი!": "You won the match!",
    "კომპიუტერმა მოიგო თამაში": "The computer won the game",
    "🏆 შენ მოიგე თამაში!": "🏆 You won the game!",
    "🏆 შენ მოიგე!": "🏆 You won!",
    "🏆 თქვენ მოიგეთ!": "🏆 You won!",
    "მოწინააღმდეგემ მოიგო": "Your opponent won",
    "მოწინააღმდეგე წყვილმა მოიგო": "The other pair won",
    "მატჩი წაგებულია": "The match is lost",
    "წააგე": "You lost",
    "(მრგვალდება ხუთამდე)": "(rounded up to five)",
    "ხელში დარჩა —": "Left in hand —",
    "მიზანი მიღწეულია, მაგრამ ხელი ბლოკით დასრულდა — ითამაშება დამატებითი ხელი.":
      "The target was reached but the hand ended blocked — one more hand is played.",
    "მიზანი მიღწეულია, მაგრამ ანგარიში თანაბარია — ითამაშება დამატებითი ხელი.":
      "The target was reached but the scores are level — one more hand is played.",
    "წყვილი A": "Pair A", "წყვილი B": "Pair B", "უწყვილო": "unpaired",
    "დაწყვილდი": "Pair up",
    "მაგიდა სავსეა —": "The table is full —",
    "⏱ ჩემი დრო": "⏱ My time", "(მარაგი)": "(reserve)",
    "მარაგი იხარჯება!": "The reserve is running!",

    // --- bura ---
    "ვარ": "var", "ვარ — სწორი!": "Var — right!", "ვარ — არასწორი": "Var — wrong",
    "ბურა!": "Bura!", "მალუტკა": "Malutka", "მალუტკა!": "Malutka!",
    "მალუტკა ვერ გამოვიდა": "That is not a malutka",
    "ყაიმი": "Draw", "— არავინ იწერს": "— nobody scores",
    "გაჭერი!": "Beaten!", "ვერ გაიჭერი": "Not beaten",
    "გაიჭრა": "Beaten", "ვერ გაიჭრა": "Not beaten",
    "მიიღე გამოძახება": "Take the call",
    "ვიღებ": "Accept", "ვთმობ": "Give it up",
    "მიღებულია": "Accepted",
    "დავი": "Davi", "სე": "Se", "ჩარი": "Chari", "ფანჯი": "Panji", "შაში": "Shashi",
    "🏆 რაუნდი შენია": "🏆 The round is yours",
    "რაუნდი წაგებულია": "The round is lost",
    "ხელი შენ აიღე": "You took the trick",
    "ხელი კომპიუტერმა აიღო": "The computer took the trick",
    "დადექი": "Stand", "ჩამოდი": "Lead",

    // --- joker ---
    "ბეზი": "No trump", "ჯოკ": "JOK",
    "მაღალი": "High", "წაიღოს": "Give it",
    "მაღლა": "high", "დაბლა": "low",
    "მაღლა ↑": "High ↑", "დაბლა ↓": "Low ↓",
    "მაღალი — რომელი ფერი?": "High — which suit?",
    "წაიღოს — რომელი ფერი?": "Give it — which suit?",
    "ჯოკერით შედიხარ — რას აცხადებ?": "Leading a joker — what are you calling?",
    "ჯოკერი — მაღლა თუ დაბლა?": "The joker — high or low?",
    "რამდენ ხელს აიღებ?": "How many tricks will you take?",
    "კოზირი ცხადდება": "The trump is being named",
    "კოზირს აცხადებს": "is naming the trump",
    "სამი კარტი გიჭირავს — დაასახელე კოზირი ან ბეზი":
      "You hold three cards — name the trump, or no trump",
    "ზუსტად! 🎯": "Exactly! 🎯", "ხიშტი 💥": "Whist 💥",
    "აიღო": "took", "აიღე [": "take [",
    "სეტის ბონუსი:": "Set bonus:",
    "საუკეთესო ხელი": "best hand",
    "📋 ისტორია": "📋 Record",
    "ჯერ არცერთი ხელი არ დასრულებულა": "No hand has finished yet",
    "პირველი ჩამომსვლელი": "leads first", "ბოლო ჩამომსვლელი": "plays last",
    "შენ ხარ დილერი —": "You are the dealer —",
    "აკრძალულია": "is not allowed",
    "უპასუხე (": "Answer (",

    // --- who you are, and the profile ---
    "შენ ვინ ხარ": "Who are you", "რა გქვია?": "What is your name?",
    "შენი სახელი": "Your name",
    "ამ სახელს დაინახავს მოწინააღმდეგე": "This is the name your opponent sees",
    "სახელის შეცვლა": "Change your name",
    "სახელი მინიმუმ 2 სიმბოლო": "A name is at least two characters",
    "სახელი შენახულია:": "Name saved:",
    "სტუმრად შესვლა": "Play as a guest", "სტუმრად თამაშობ": "You are playing as a guest",
    "როგორ შემოხვალ?": "How would you like to sign in?",
    "Google-ით შესული ✓": "Signed in with Google ✓",
    "დამოწმებული სახელი": "a verified name",
    "ან": "or",
    "პროფილი და მიღწევები": "Profile and achievements",
    "პროფილი": "Profile", "მიმოხილვა": "Overview", "მიღწევები": "Achievements",
    "დონე": "Level", "ნათამაშები": "Played", "მოგების %": "Won %",
    "საუკ. სერია": "Best streak", "სერია:": "Streak:", "· სერია": "· streak",
    "ყოველდღიური პრიზი": "Daily prize",
    "მიიღე": "Claim", "დღეს აღებულია": "Claimed today",
    "დღეს უკვე აიღე — დაბრუნდი ხვალ": "Already claimed today — come back tomorrow",
    "შემდეგი უფასო მონეტები": "Next free coins",
    "🪙 უფასო მონეტები": "🪙 Free coins",
    "აიღე მონეტები და განაგრძე თამაში": "Take some coins and keep playing",
    "არ გყოფნის მონეტა — ფსონი 🪙": "Not enough coins — the stake is 🪙",
    "მაღაზია": "Shop", "🛒 მაღაზია": "🛒 Shop",
    "გარეგნობა — თამაშზე არაფერს ცვლის": "Looks only — it changes nothing in the game",
    "არჩეული": "In use", "გამოიყენე": "Use", "გამოყენება": "Use",
    "ეს ვერ ვიყიდე": "Could not buy that",
    "საკმარისი არ არის": "Not enough",
    "კოდის გამოყენება": "Use a code",
    "კოდი არ ემთხვევა": "That code does not match",
    "ეს კოდი უკვე გამოყენებულია": "That code has already been used",
    "კოდები ამჟამად არ მუშაობს": "Codes are not working at the moment",
    "თითო ანგარიშზე ერთხელ": "Once per account",
    "მენიუ": "Menu", "გამოსვლა": "Sign out",
    "გამარჯობა,": "Hello,",
    "ვერ მოხერხდა": "That did not work",

    // --- signing in ---
    "შედი Google-ით და სახელს ვერავინ მოგპარავს":
      "Sign in with Google and nobody can take your name",
    "სერვერს ვერ დავუკავშირდი — Google-ით შესვლა ახლა ვერ მოხერხდება":
      "Could not reach the server — signing in with Google will not work just now",
    "Google-ით შესვლა ვერ მოხერხდა": "Signing in with Google did not work",

    /* The computer players have names, and a name is a name — these are the
       same three people, spelled so an English reader can say them. */
    "გიორგი": "Giorgi", "ნინო": "Nino", "დათო": "Dato", "ლაშა": "Lasha",
    "ერთი": "One", "ორი": "Two", "სამი": "Three", "ოთხი": "Four",
    "მასპინძელი": "Host",

        // --- the bottom bar of the front page ---
    "რეჟიმები": "Modes", "დავალებები": "Tasks", "ბორბალი": "Wheel",
    "თასები": "Cups", "სოციალური": "Social",
  };

  /* Strings built at run time — a name and a verb, a count and a word. Matched
     on the finished text, because that is what reaches the page. */
  const PATTERNS = [
    [/^(.+) ჩამოვიდა (\d+) ქვით$/, (m) => `${m[1]} led ${m[2]} card${m[2] === "1" ? "" : "s"}`],
    [/^(.+) ჩამოვიდა$/, (m) => `${m[1]} led`],
    [/^(.+) ფიქრობს$/, (m) => `${m[1]} is thinking`],
    [/^(.+) ბიდავს$/, (m) => `${m[1]} is bidding`],
    [/^(.+) კოზირს აცხადებს$/, (m) => `${m[1]} is naming the trump`],
    [/^(.+) გავიდა$/, (m) => `${m[1]} left`],
    [/^(.+) დაბრუნდა$/, (m) => `${m[1]} is back`],
    [/^(.+) გაჭრა$/, (m) => `${m[1]} beat it`],
    [/^(.+) ვერ გაჭრა$/, (m) => `${m[1]} could not beat it`],
    [/^(.+): ბურა!$/, (m) => `${m[1]}: bura!`],
    [/^(.+) — მალუტკა!$/, (m) => `${m[1]} — malutka!`],
    [/^(.+) — ბურა!$/, (m) => `${m[1]} — bura!`],
    [/^ხელი აიღო — (.+)$/, (m) => `Trick to ${m[1]}`],
    [/^(.+)-მ აიღო$/, (m) => `Taken by ${m[1]}`],
    [/^ველოდებით — (\d+)\/(\d+)$/, (m) => `Waiting — ${m[1]}/${m[2]}`],
    [/^(\d+) მოთამაშე კიდევ$/, (m) => `${m[1]} more player${m[1] === "1" ? "" : "s"}`],
    [/^გაუზიარე კოდი — (\d+) მოთამაშე კიდევ$/,
      (m) => `Share the code — ${m[1]} more player${m[1] === "1" ? "" : "s"}`],
    [/^ველოდებით: (.+)$/, (m) => `Waiting for: ${m[1]}`],
    [/^(.+) დატოვა მაგიდა\.$/, (m) => `${m[1]} left the table.`],
    [/^(.+) — კავშირი გაწყდა, ველოდებით…$/, (m) => `${m[1]} — connection lost, waiting…`],
    [/^(.+) — ადგილი დაცულია, ქვებს კომპიუტერი აგრძელებს$/,
      (m) => `${m[1]} — the chair is held; the computer plays it`],
    [/^(.+) — დრო ამოიწურა$/, (m) => `${m[1]} — out of time`],
    [/^(.+) გავიდა — მის ქვებს კომპიუტერი აგრძელებს$/,
      (m) => `${m[1]} left — the computer plays their tiles`],
    [/^(.+) გავიდა — (\d+)\/(\d+)$/, (m) => `${m[1]} left — ${m[2]}/${m[3]}`],
    [/^სახელი შენახულია: (.+)$/, (m) => `Name saved: ${m[1]}`],
    [/^გამარჯობა, (.+)$/, (m) => `Hello, ${m[1]}`],
    [/^შენ ხარ დილერი — (\d+) აკრძალულია$/, (m) => `You are the dealer — ${m[1]} is not allowed`],
    [/^მოწინააღმდეგის ხელი: \+(\d+) ქულა\.$/, (m) => `Opponent's hand: +${m[1]} points.`],
    [/^დაიწყო — (.+)$/, (m) => `Started — ${m[1]}`],
    [/^ხელი დასრულდა$/, () => "The hand is over"],
    [/^სეტის ბონუსი: (.+)$/, (m) => `Set bonus: ${m[1]}`],
    [/^ანგარიში (\d+) : (\d+)$/, (m) => `Score ${m[1]} : ${m[2]}`],
    [/^(.+) — რიბა! დამატებითი ხელი$/, (m) => `${m[1]} — riba! one more hand`],
    [/^(.+) — თანაბარია! დამატებითი ხელი$/, (m) => `${m[1]} — level! one more hand`],
  ];

  let lang = null;
  try { lang = localStorage.getItem(STORE); } catch (e) { /* private mode */ }
  if (lang !== "en" && lang !== "ka") lang = "ka";

  /* The translation of one string, or the string itself. Leading and trailing
     space is kept, because plenty of these sit between other words. */
  function one(text) {
    if (lang !== "en" || !text || !KA.test(text)) return text;
    const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
    const core = text.trim();
    if (EN[core] !== undefined) return lead + EN[core] + tail;
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) return lead + fn(m) + tail;
    }
    /* Not a whole string we know — try it as a sentence built from pieces we
       do. "ბიდი | ანგარიში 3 : 2" and the like are joined at run time. */
    let out = core, hit = false;
    for (const part of Object.keys(EN)) {
      if (part.length < 4 || out.indexOf(part) < 0) continue;
      out = out.split(part).join(EN[part]);
      hit = true;
    }
    return hit ? lead + out + tail : text;
  }

  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, SVG: 1 };
  function walk(node) {
    if (!node) return;
    if (node.nodeType === 3) {
      const t = one(node.nodeValue);
      if (t !== node.nodeValue) node.nodeValue = t;
      return;
    }
    if (node.nodeType !== 1) return;
    if (SKIP[node.tagName]) return;
    for (const a of ["placeholder", "title", "aria-label"]) {
      const v = node.getAttribute && node.getAttribute(a);
      if (v && KA.test(v)) { const t = one(v); if (t !== v) node.setAttribute(a, t); }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }

  function apply(root) {
    if (lang !== "en") return;
    walk(root || document.body);
  }

  /* Anything drawn after the first pass — a hand redrawn, a dialog opened — is
     translated as it lands. One watcher does for the whole screen, which is
     what keeps the screens themselves free of any of this. */
  function watch() {
    if (lang !== "en" || !global.MutationObserver) return;
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") walk(r.target);
        else r.addedNodes.forEach((n) => walk(n));
      }
    });
    mo.observe(document.documentElement,
      { childList: true, subtree: true, characterData: true });
  }

  function set(l) {
    lang = (l === "en") ? "en" : "ka";
    try { localStorage.setItem(STORE, lang); } catch (e) { /* private mode */ }
    location.reload();              // the simplest way to put every string back
  }

  function start() {
    document.documentElement.setAttribute("lang", lang);
    apply(document.body);
    watch();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  global.I18N = { get lang() { return lang; }, set, t: one, apply, EN };
})(window);
