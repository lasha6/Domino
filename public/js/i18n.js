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
    "👥 2v2 წყვილებით": "👥 2v2 in pairs",
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
    "ადგილს ვთმობ": "Give up the seat",
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
    "პრაქტიკა": "Practice",
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

        // --- the rules, and the rest of the front page ---
    "მიზანი.": "The goal.", "ქულა.": "Scoring.", "სტავკა.": "The spinner.",
    "ბაზარი.": "The boneyard.", "ხელის დასასრული.": "The end of a hand.",
    "ბლოკი.": "Blocked.", "რიბა.": "Riba.",
    "პირველმა დააგროვე ოთახის ქულა — 75, 175, 255 ან 355.":
      "Be first to the table's target — 75, 175, 255 or 355.",
    "ყოველი დადების შემდეგ დაითვალე მაგიდის ღია ბოლოები. თუ ჯამი 5-ზე იყოფა, ეს ქულა შენია.":
      "After every tile, add up the open ends. If the total divides by five, those points are yours.",
    "პირველი დადებული დუბლი (ან პირველი, რომელსაც ორივე მხრიდან ქვა დაედება) ხდება სტავკა — მას ორი დამატებითი მკლავი აქვს.":
      "The first double played (or the first with a tile on both sides) becomes the spinner, and the line grows two more arms from it.",
    "სვლა თუ არ გაქვს, აიღე ქვა. ბოლო ორი ქვა არასდროს იღება.":
      "With no move, take a tile. The last two are never taken.",
    "ვინც ქვებს ადრე მორჩება, იღებს მოწინააღმდეგის ხელში დარჩენილ ქულებს — მრგვალდება 5-მდე ზემოთ.":
      "Whoever runs out of tiles first takes what is left in the other hands, rounded up to five.",
    "თუ სვლა არავის აქვს, იგებს ის, ვისაც ხელში ნაკლები დარჩა.":
      "If nobody can move, the hand goes to whoever holds the least.",
    "თუ ვინმემ მიზანს მიაღწია, მაგრამ ხელი ბლოკით დასრულდა, ინიშნება დამატებითი ხელი — მოწინააღმდეგეს კიდევ აქვს შანსი.":
      "If the target is reached on a blocked hand, one more hand is played — the other side still has a chance.",
    /* --- waiting for somebody, and the rest of the front page --- */
    "ველოდებით მოწინააღმდეგეს…": "Waiting for an opponent…",
    "გაუზიარე ეს კოდი მეგობარს": "Share this code with your friend",
    "შეჩერებულია": "Paused",
    "კავშირი გაწყდა…": "The connection has gone…",
    "შექმენი მაგიდა და გაუგზავნე კოდი, ან შედი მეგობრის კოდით": "Make a table and send the code, or go in with a friend's",
    "Google ვერ ჩაიტვირთა — სტუმრად მაინც შეგიძლია თამაში": "Google would not load — you can still play as a guest",
    "Google-ით შესული ხარ — სახელი დამოწმებულია ✓": "Signed in with Google — the name is verified ✓",
    "პროგრესი ვერ ჩავტვირთე — სცადე თავიდან შესვლა": "Your progress would not load — try signing in again",
    "მონეტები გამოგელია — აიღე უფასოდ და განაგრძე": "Out of coins — take some for nothing and carry on",
    "მონეტები ჯერ გყოფნის — ითამაშე და მოიგე": "You still have coins — play and win more",
    "დომინო თარაზულ (landscape) რეჟიმში ითამაშება — მოაბრუნე ტელეფონი გვერდზე.": "Domino is played sideways — turn the phone on its side.",
    "მიღებულია!": "Taken!",
    "გამოხვედი": "You left",
    "მოგებული": "Won",
    "აიღე": "Take it",
    "ხელები": "Hands",
    "~3 წთ · 2–3 ხელი": "~3 min · 2–3 hands",
    "~6 წთ · 5 ხელი": "~6 min · 5 hands",
    "~8 წთ · 7 ხელი": "~8 min · 7 hands",
    "~11 წთ · 10 ხელი": "~11 min · 10 hands",
    /* --- the board games: ნარდი and დამკა --- */
    "ნარდი": "Nardi",
    "დამკა": "Damka",
    "კლასიკური ნარდი": "Classic Nardi",
    "მოკლე ნარდი": "Backgammon",
    "კლასიკური, მოკლე · დამკა": "Classic, short · damka",
    "თავიდან, ჭამის გარეშე": "From the head, nothing is hit",
    "ჭამით და ბარიდან შემოსვლით": "Hitting, and coming back off the bar",
    "8×8 · ჭამა სავალდებულოა": "8×8 · taking is compulsory",
    "კომპიუტერთან — ონლაინი მოგვიანებით": "Against the computer — online later",
    "ნარდი — კომპიუტერთან": "Nardi — against the computer",
    "დამკა — კომპიუტერთან": "Damka — against the computer",
    "კლასიკური ნარდი — კომპიუტერთან": "Classic Nardi — against the computer",
    "მოკლე ნარდი — კომპიუტერთან": "Backgammon — against the computer",
    "ანგარიში": "Score",
    "გზა": "Pips",
    "გააგორე": "Roll",
    "შენი გაგორებაა": "Your roll",
    "კომპიუტერს სვლა არ ჰქონდა": "The computer had no move",
    "სვლა არ არის": "No move",
    "პარტია შენია": "The game is yours",
    "პარტია კომპიუტერს": "The game goes to the computer",
    "მარსი": "Gammon",
    "კოკა": "Backgammon",
    "მოგება": "A win",
    "ფრე": "A draw",
    "მოიგე!": "You won!",
    "ქვები აღარ დარჩა": "Nothing left to play with",
    "სვლა აღარ არის": "No move left",
    "დიდხანს არავის არაფერი წაუღია.": "Nothing has been taken for a long time.",
    /* --- and the two board games' rules --- */
    "დამკა.": "The queen.", "ფრე.": "A draw.",
    "ორი მოთამაშე, თხუთმეტ-თხუთმეტი ქვა და ორი კამათელი.": "Two players, fifteen checkers each and two dice.",
    "ორი ნარდი.": "Two games.",
    "გრძელში ქვა არავის ეჭმევა და ერთი მოწინააღმდეგის ქვაც კეტავს პუნქტს; მოკლეში მარტო მდგომი ქვა იჭმევა და ბარზე გადადის.": "In the long game nothing is ever hit and a single enemy checker shuts a point; in the short one a lone checker is a blot, and it goes to the bar.",
    "საწყისი განლაგება.": "The opening position.",
    "გრძელში თხუთმეტივე ქვა შენს „თავზე\" დგას და ორივე ერთი მიმართულებით დადის. მოკლეში ცნობილი განლაგებაა: 2 · 5 · 3 · 5.": "In the long game all fifteen stand on your own head and both sides run the same way round. The short one has the spread everybody knows: 2 · 5 · 3 · 5.",
    "კამათლების რიცხვი ნაბიჯებია. ორივე უნდა ითამაშო, თუ ორივე თამაშდება; თუ მხოლოდ ერთი — მაშინ დიდი. დუბლი ოთხი სვლაა, არა ორი.": "The dice are steps. Both must be played if both can be; if only one can, it has to be the bigger. A double is four moves, not two.",
    "თავიდან (კლასიკური).": "Off the head (classic).",
    "ერთ სვლაზე თავიდან რამდენი ქვაც გინდა, იმდენი ჩამოდის — შეზღუდვა არ არის. დუბლზე ოთხივე შეიძლება ერთად ჩამოვიდეს.": "As many checkers may leave the head in a turn as you like — there is no limit on it. On a double all four may come off together.",
    "ექვსი ზედიზედ (კლასიკური).": "Six in a row (classic).",
    "ექვსი შენი პუნქტი ზედიზედ კედელია. აკრძალულია, თუ მოწინააღმდეგის ერთი ქვაც არ არის უკვე გასული — თორემ თამაში იქვე მთავრდება.": "Six of your points in a row is a wall. It is not allowed unless at least one enemy checker is already past it — otherwise the game ends there and then.",
    "ჭამა (მოკლე).": "Hitting (short).",
    "მარტო მდგომ ქვას ეჭმევა და ბარზე გადადის. სანამ ბარიდან არ შემოვა, სხვა ქვას ვერ ახმევ.": "A checker standing alone is hit and goes to the bar. Until it comes back in, nothing else of yours may move.",
    "გატანა.": "Bearing off.",
    "ქვები მხოლოდ მაშინ გააქვს, როცა თხუთმეტივე სახლშია. ზუსტი რიცხვი ყოველთვის გააქვს; მეტი რიცხვი — მხოლოდ ყველაზე შორს მდგომს, სხვის თავზე გადახტომა არ შეიძლება.": "Nothing comes off until all fifteen are home. An exact roll always bears one off; a bigger roll takes the checker furthest from home, and never jumps over one behind it.",
    "მოგება ერთი ქულაა. თუ წაგებულს ერთი ქვაც არ გაუტანია — მარსი, ორი ქულა. მოკლეში, თუ თანაც ბარზე უდგას ან შენს სახლშია — კოკა, სამი ქულა.": "A win is one point. If the loser bore none off it is a gammon, worth two. In the short game, if on top of that they still have a checker on the bar or in your home, it is a backgammon, worth three.",
    "მატჩი.": "The match.",
    "ვინც ოთახის ქულას პირველი მიაღწევს. შემდეგ პარტიას წაგებული იწყებს.": "Whoever reaches the table's target first. The loser opens the next game.",
    "8×8, თორმეტ-თორმეტი ქვა მუქ უჯრებზე.": "Eight by eight, twelve pieces each, on the dark squares.",
    "ჩვეულებრივი ქვა დიაგონალზე ერთ უჯრას წინ მიდის.": "A man walks one square diagonally forward.",
    "ჭამა სავალდებულოა.": "Taking is compulsory.",
    "თუ ჭამა შეგიძლია, ჭამა უნდა ითამაშო. რამდენიმე ვარიანტიდან თვითონ ირჩევ — ყველაზე გრძელი აქ სავალდებულო არაა.": "If there is a jump, a jump is what you play. When several are open you choose freely — taking the longest line is not required here.",
    "უკან ჭამა.": "Taking backwards.",
    "ჩვეულებრივი ქვა ჭამს ყველა მიმართულებით — წინ და უკან ერთნაირად. სიარული კი მხოლოდ წინ შეუძლია.": "A man takes in every direction, backwards as readily as forwards. Walking, though, is forwards only.",
    "ჯაჭვი.": "The chain.",
    "თუ ჭამის შემდეგ კიდევ შეგიძლია ჭამო, უნდა გააგრძელო. ეს ერთი სვლაა და არა რამდენიმე.": "If you can take again after taking, you must. It is one move, not several.",
    "ერთი ქვა ერთხელ.": "One piece, once.",
    "ერთსა და იმავე ქვას ერთ სვლაში ორჯერ ვერ გადაახტები. ამიტომ შეჭმული ქვები დაფაზე რჩება სვლის ბოლომდე და გზას კეტავს.": "Nothing is jumped twice in one move. That is why a captured piece stays on the board, blocking, until the move is over.",
    "ბოლო ხაზამდე მისული ქვა დამკა ხდება იმავე წამს. თუ ჭამის შუაში გადაიქცა და ჭამა კიდევ შეუძლია — უკვე დამკად აგრძელებს.": "A man reaching the far row is crowned there and then. If it happens mid-jump and it can take again, it carries on as a queen.",
    "როგორ დადის დამკა.": "How a queen moves.",
    "დიაგონალზე რამდენ უჯრასაც უნდა, ორივე მიმართულებით. ვერაფერს გადაუვლის — მხოლოდ ცარიელ უჯრებზე.": "As far along a diagonal as she likes, either way. She passes over nothing — only empty squares.",
    "როგორ ჭამს დამკა.": "How a queen takes.",
    "შორიდანაც: ერთ მოწინააღმდეგის ქვას გადაახტება, წინ და უკან რამდენიც უნდა ცარიელი უჯრა იყოს, და მის იქით ნებისმიერ ცარიელ უჯრაზე ჩერდება. ორი ქვა ზედიზედ კი მას აჩერებს.": "At a distance: over one enemy piece, with any amount of empty air before and after it, landing on any empty square beyond. Two enemy pieces in a row stop her.",
    "წაგება.": "Losing.",
    "ქვები რომ აღარ დაგრჩა — წააგე. და მაშინაც, თუ ქვები გყავს, მაგრამ სვლა აღარ გაქვს.": "You lose when you have nothing left. And equally when you have pieces but no move.",
    "თუ დიდხანს არავის არაფერი წაუღია და ჩვეულებრივი ქვა არ დაძრულა, პარტია ფრედ ითვლება.": "If nothing has been taken and no man has moved for a long stretch, the game is a draw.",
    /* --- the rules window: the same three games, told properly --- */
    "ქართული „ოზი\" — ორი მოთამაშე, ან ორ-ორი წყვილად.": "Georgian \"Ozi\" — two players, or two pairs.",
    "წყვილებით.": "In pairs.",
    "ოთხი მოთამაშე, პარტნიორები პირისპირ სხედან და ქულას ერთად აგროვებენ. ოთხივეს შვიდ-შვიდი ქვა უჭირავს, ესე იგი ბაზარი აღარ რჩება — გაჭედილი უბრალოდ პასს იძლევა.": "Four players, partners facing each other and scoring together. All four hold seven tiles, so nothing is left for a boneyard — anyone stuck simply passes.",
    "ხუთკარტა და სამკარტა — ორი მოთამაშე; ხუთკარტა ორ-ორ წყვილადაც.": "Five-card and three-card, for two players; five-card is also played as two pairs.",
    "პირველმა დააგროვე ოთახის ქულა — 6, 11 ან 21.": "Be first to the table's target — 6, 11 or 21.",
    "კოლოდა.": "The deck.",
    "ხუთკარტაში 36 კარტია და ხელში ხუთი გიჭირავს. სამკარტაში ექვსიანიდან ცხრიანამდე ამოღებულია — 20 კარტი, ხელში სამი.": "Five-card uses all 36 cards and you hold five. Three-card takes out the sixes to nines — 20 cards, and you hold three.",
    "კარტის ძალა.": "Card strength.",
    "6 · 7 · 8 · 9 · J · Q · K · 10 · A — ყურადღება: ბურაში ათიანი ჯოტზე მაღლა დგას.": "6 · 7 · 8 · 9 · J · Q · K · 10 · A — note that in Bura the ten sits above the jack.",
    "რა რამდენი ღირს.": "What each card is worth.",
    "ტუზი 11, ათიანი 10, კარალი 4, დამა 3, ჯოტი 2, დანარჩენი — არაფერი. მთელ კოლოდაში ზუსტად 120 ქულაა.": "Ace 11, ten 10, king 4, queen 3, jack 2, everything else nothing. There are exactly 120 points in the deck.",
    "კოზირი.": "Trump.",
    "დარიგების ბოლოს ერთი კარტი გადაბრუნდება — მისი ფერი კოზირია და ის კარტი კოლოდიდან ბოლო ასაღებია.": "One card is turned up at the end of the deal — its suit is trump, and it is the last card anyone draws.",
    "სვლა.": "Playing.",
    "ფერის მიყოლა ვალდებულება არაა: ან სჯობნი — იმავე ფერის მაღალით ან კოზირით — ან უბრალოდ ყრი. ვინც ხელს აიღებს, ის შედის.": "You do not have to follow suit: either you beat what is down — with a higher card of the same suit, or with a trump — or you simply throw a card away. Whoever takes the trick leads next.",
    "რაუნდის შედეგი.": "How a round is decided.",
    "120-დან 60 ზუსტად ნახევარია: ვინც 60-ს გადააჭარბა, ის იგებს. 60-60 ყაიმია და არავის არაფერი ეწერება.": "Sixty is exactly half of 120: whoever passes 60 wins the round. Sixty each is a draw and nobody scores.",
    "დავი, სე, ჩარი…": "Davi, se, chari…",
    "რაუნდის ფასს ზრდის: დავი ორმაგდება, სე სამმაგდება და ასე შემდეგ — ფანჯი, შაში. წყვილებში გამოძახებას მოწინააღმდეგე გუნდის ორივე წევრი უნდა დაეთანხმოს.": "These raise what the round is worth: davi doubles it, se trebles it, and so on through fanji and shashi. In pairs, both members of the other team have to accept the call.",
    "ვარ.": "Var.",
    "მხოლოდ სამკარტაშია. აცხადებ, რომ უკვე 32 ქულა გაქვს აღებული — თუ მართალი ხარ, რაუნდი შენია; თუ არა, წაგებული.": "Three-card only. You claim you have already taken 32 points — right, and the round is yours; wrong, and it is lost.",
    "მალუტკა.": "Malutka.",
    "ერთფერიანი ხელი. ჯერს არ ელოდება: ცარიელ მაგიდაზე ჩამოსვლაა, ჩამოსულ კარტზე კი უკან ბრუნდება — ახლა მას სჭირდება მისი გატანა.": "A hand all of one suit. It does not wait for your turn: on an empty table it is a lead, and on a card just played it is turned straight back — now it is their job to beat it.",
    "ბურა.": "Bura.",
    "სულ კოზირი გიჭირავს. სამკარტაში ეს რაუნდს მაშინვე იგებს; ხუთკარტაში — ჯერის გარეშე დადებული ხელია და გასათამაშებელი რჩება.": "A hand of nothing but trumps. In three-card it wins the round outright; in five-card it is a hand you may put down out of turn, and it still has to be played for.",
    "ოთხი მოთამაშე, პარტნიორები პირისპირ, თამაში საათის ისრით. მხოლოდ ხუთკარტა. ვარი აქ არ არის, ქულა კი გუნდისაა — პარტნიორის გატანა ან გაჭრა ვალდებულება არაა.": "Four players, partners facing each other, play going clockwise. Five-card only. There is no var here and the points belong to the team — you are never obliged to beat your partner or to let them through.",
    "ოთხი მოთამაშე, გუნდების გარეშე — ყველა თავისთვის.": "Four players, no teams — everybody for themselves.",
    "36 კარტი, ოღონდ ორი შავი ექვსიანის ნაცვლად ორი ჯოკერია.": "Thirty-six cards, except that the two black sixes are replaced by two jokers.",
    "6 · 7 · 8 · 9 · 10 · J · Q · K · A — ყურადღება: ჯოკერში ათიანი ჯოტზე დაბლაა, ბურაში კი პირიქით.": "6 · 7 · 8 · 9 · 10 · J · Q · K · A — note that here the ten sits below the jack, the other way round from Bura.",
    "24 ხელი, ოთხი სეტი.": "Twenty-four hands, four sets.",
    "ჯერ თითო კარტიდან რვამდე, მერე ოთხი ცხრიანი ხელი, მერე რვიდან უკან ერთამდე და კიდევ ოთხი ცხრიანი.": "First one card up to eight, then four hands of nine, then eight back down to one, then four more of nine.",
    "პატარა ხელებში დარჩენილი კოლოდის ზედა კარტი გადაბრუნდება და მისი ფერი კოზირია; გადაბრუნებული ჯოკერი კი ბეზს ნიშნავს — კოზირი არ არის.": "In the small hands the top card of what is left is turned up and its suit is trump; a turned joker means no trump at all.",
    "კოზირი ცხრიანებში.": "Trump in the nines.",
    "ოთხჯერ ცხრა მთელი კოლოდაა, გადასაბრუნებელი აღარაფერი რჩება. ამიტომ დილერის მარცხენა მოთამაშე ჯერ სამ კარტს ხედავს და სწორედ ის აცხადებს კოზირს ან ბეზს, დანარჩენი კი მერე რიგდება.": "Four nines is the whole deck, so there is nothing left to turn. Instead the player on the dealer's left sees three cards first and names the trump, or no trump, and the rest is dealt after that.",
    "ბიდი.": "The bid.",
    "ყველა აცხადებს, რამდენ ხელს აიღებს — დილერის მარცხნიდან, დილერი ბოლოს. დილერს ერთი რიცხვი ეკრძალება: ის, რომლითაც ჯამი ხელების რაოდენობას დაემთხვევა. ვიღაცამ აუცილებლად უნდა ცდეს.": "Everyone says how many tricks they will take, starting left of the dealer and ending with the dealer. One number is closed to the dealer: the one that would make the bids add up to the tricks. Somebody has to be wrong.",
    "ჩამოსულ ფერს მიჰყევი. თუ ის ფერი არ გაქვს — კოზირით გაჭერი. თუ კოზირიც არ გაქვს — რაც გინდა, ის დადე. ჯოკერის დადება ყოველთვის შეიძლება.": "Follow the suit that was led. Without it, you must trump. Without a trump either, play whatever you like. A joker may always be played.",
    "ქულა — ზუსტი.": "Scoring — exact bids.",
    "50 თითო აღებულ ხელზე პლუს 50 სისწორისთვის: 0 თქვი და 0 აიღე — 50 ქულა; 3 თქვი და 3 აიღე — 200. ნულიც ითვლება, თუ ზუსტია.": "Fifty a trick plus fifty for being right: bid 0 and take 0 for 50; bid 3 and take 3 for 200. A bid of nothing counts too, as long as it was right.",
    "ყველა ხელი.": "Every trick.",
    "თუ ყველა ხელი დაიბიდე და ყველა აიღე — 100 თითოზე. მხოლოდ მაშინ: უთქმელად აღება ჩვეულებრივი ცდომაა.": "Bid every trick and take every trick and each is worth a hundred. Only then: taking them all without having said so is an ordinary miss.",
    "ცდომა.": "A miss.",
    "თუ ვერ შეასრულე, აღებული ხელები 10-10 ქულად ჩაგეთვლება.": "If you do not make your bid, each trick you took is worth ten.",
    "ხიშტი.": "Whist.",
    "თქვი ერთი მაინც და ვერაფერი აიღე — მინუს 200 პირველ და მესამე სეტში, მინუს 500 ცხრიანებში.": "Say you will take at least one and take none: minus 200 in the first and third sets, minus 500 in the nines.",
    "სეტის ბონუსი.": "The set bonus.",
    "თუ მთელ სეტში ყველა ბიდი ზუსტად შეასრულე, იმ სეტის შენი საუკეთესო ხელი კიდევ ერთხელ ჩაგეწერება.": "Get every bid in a set exactly right and your best hand of that set is written down again.",
    "ჯოკერით შესვლა.": "Leading a joker.",
    "ორნაირად შეიძლება, და სხვაობა დიდია.": "There are two ways to do it, and the difference matters.",
    "ჯოკერი იღებს.": "The joker takes it.",
    "ასახელებ ფერს და ყველა ვალდებულია იმ ფერის უმაღლესი ჩამოიტანოს; ხელს კი ჯოკერი იღებს.": "You name a suit and everybody owes the highest card they hold of it — and the joker wins the trick.",
    "ფერმა წაიღოს.": "Let the suit take it.",
    "ვალდებულება არაა — იმ ფერის უმაღლესი იღებს. ვისაც ის ფერი არ აქვს, კოზირით წაიღებს; ფერი თუ არავის აღმოაჩნდა, ჯოკერი იღებს.": "Nobody owes their highest — the best card of that suit takes it. Anyone without the suit may cut with a trump, and if the suit turns out to be in nobody's hand the joker takes it after all.",
    "ჯოკერი პასუხად.": "A joker in answer.",
    "მაღლა დადებული ჯოკერი ხელს იღებს — ორიდან ის, ვინც ბოლოს დადო; დაბლა დადებული კი უბრალოდ იყრება.": "A joker played high takes the trick — with two of them, whoever played last; played low it is simply thrown away.",
    "💎 გროვდება დონეებით — ყოველ დონეზე 2": "💎 Earned by levelling up — two a level",
    "ცოცხალ მოწინააღმდეგესთან": "Against a live opponent",
    "კომპიუტერთან — პრაქტიკა, მონეტების გარეშე": "Against the computer — practice, no coins",
    "მიიღებ კოდს და გაუზიარებ მეგობარს": "You get a code to share with a friend",
    // --- the domino table talks a lot ---
    "აირჩიე ადგილი მაგიდაზე — მწვანე ადგილები": "Pick a place on the table — the green ones",
    "ბაზარი დახურულია (ბოლო 2 რჩება) — პასი": "The boneyard is shut (the last two stay) — pass",
    "კომპიუტერი: პასი (ბაზარი დახურულია)": "Computer: pass (the boneyard is shut)",
    "კომპიუტერს სვლა არ აქვს, ბაზარი დახურულია — პასი":
      "The computer has no move and the boneyard is shut — pass",
    "სვლა არ გაქვს, ბაზარი დახურულია — პასი": "You have no move and the boneyard is shut — pass",
    "პასი": "pass",
    // --- the bottom bar of the front page ---
    "რეჟიმები": "Modes", "დავალებები": "Tasks", "ბორბალი": "Wheel",
    "თასები": "Cups", "სოციალური": "Social",
  };

  /* Strings built at run time — a name and a verb, a count and a word. Matched
     on the finished text, because that is what reaches the page. A name inside
     one is put through the dictionary too: the three computer players have
     names, and half-translating a sentence is worse than not touching it. */
  const PATTERNS = [
    [/^(.+) ჩამოვიდა (\d+) ქვით$/, (m) => `${one(m[1])} led ${m[2]} card${m[2] === "1" ? "" : "s"}`],
    [/^(.+) ჩამოვიდა$/, (m) => `${one(m[1])} led`],
    [/^(.+) ფიქრობს$/, (m) => `${one(m[1])} is thinking`],
    [/^(.+) ბიდავს$/, (m) => `${one(m[1])} is bidding`],
    [/^(.+) კოზირს აცხადებს$/, (m) => `${one(m[1])} is naming the trump`],
    [/^(.+) გავიდა$/, (m) => `${one(m[1])} left`],
    [/^(.+) დაბრუნდა$/, (m) => `${one(m[1])} is back`],
    [/^(.+) გაჭრა$/, (m) => `${one(m[1])} beat it`],
    [/^(.+) ვერ გაჭრა$/, (m) => `${one(m[1])} could not beat it`],
    [/^(.+): ბურა!$/, (m) => `${one(m[1])}: bura!`],
    [/^(.+): (\d+)$/, (m) => `${one(m[1])}: ${m[2]}`],
    [/^(.+) — მალუტკა!$/, (m) => `${one(m[1])} — malutka!`],
    [/^(.+) — ბურა!$/, (m) => `${one(m[1])} — bura!`],
    [/^ხელი აიღო — (.+)$/, (m) => `Trick to ${one(m[1])}`],
    [/^(.+)-მ აიღო$/, (m) => `Taken by ${one(m[1])}`],
    [/^ველოდებით — (\d+)\/(\d+)$/, (m) => `Waiting — ${m[1]}/${m[2]}`],
    [/^(\d+) მოთამაშე კიდევ$/, (m) => `${m[1]} more player${m[1] === "1" ? "" : "s"}`],
    [/^გაუზიარე კოდი — (\d+) მოთამაშე კიდევ$/,
      (m) => `Share the code — ${m[1]} more player${m[1] === "1" ? "" : "s"}`],
    [/^ველოდებით: (.+)$/, (m) => `Waiting for: ${one(m[1])}`],
    [/^(.+) დატოვა მაგიდა\.$/, (m) => `${one(m[1])} left the table.`],
    [/^(.+) — კავშირი გაწყდა, ველოდებით…$/, (m) => `${one(m[1])} — connection lost, waiting…`],
    [/^(.+) — ადგილი დაცულია, ქვებს კომპიუტერი აგრძელებს$/,
      (m) => `${one(m[1])} — the chair is held; the computer plays it`],
    [/^(.+) — დრო ამოიწურა$/, (m) => `${one(m[1])} — out of time`],
    [/^(.+) გავიდა — მის ქვებს კომპიუტერი აგრძელებს$/,
      (m) => `${one(m[1])} left — the computer plays their tiles`],
    [/^(.+) გავიდა — (\d+)\/(\d+)$/, (m) => `${one(m[1])} left — ${m[2]}/${m[3]}`],
    [/^სახელი შენახულია: (.+)$/, (m) => `Name saved: ${m[1]}`],
    [/^გამარჯობა, (.+)$/, (m) => `Hello, ${m[1]}`],
    [/^შენ ხარ დილერი — (\d+) აკრძალულია$/, (m) => `You are the dealer — ${m[1]} is not allowed`],
    [/^მოწინააღმდეგის ხელი: \+(\d+) ქულა\.$/, (m) => `Opponent's hand: +${m[1]} points.`],
    [/^დაიწყო — (.+)$/, (m) => `Started — ${one(m[1])}`],
    [/^სეტის ბონუსი: (.+)$/, (m) => `Set bonus: ${m[1]}`],
    [/^ანგარიში (\d+) : (\d+)$/, (m) => `Score ${m[1]} : ${m[2]}`],
    [/^(.+) — რიბა! დამატებითი ხელი$/, (m) => `${one(m[1])} — riba! one more hand`],
    [/^(.+) — თანაბარია! დამატებითი ხელი$/, (m) => `${one(m[1])} — level! one more hand`],

    // a name wearing the dealer's mark, or the computer's
    [/^(.+) 🃏$/, (m) => `${one(m[1])} 🃏`],
    [/^(.+) 🤖$/, (m) => `${one(m[1])} 🤖`],

    // the domino table narrates every move, with the tile in brackets
    [/^კომპიუტერმა ითამაშა \[(.+)\]$/, (m) => `The computer played [${m[1]}]`],
    [/^შენ ითამაშე \[(.+)\] — ახლა შენი სვლაა$/, (m) => `You played [${m[1]}] — your move again`],
    [/^შენ ითამაშე \[(.+)\]$/, (m) => `You played [${m[1]}]`],
    [/^აიღე \[(.+)\] — ახლა შენი სვლაა$/, (m) => `You took [${m[1]}] — your move`],
    [/^აიღე \[(.+)\]$/, (m) => `You took [${m[1]}]`],
    [/^კომპიუტერმა აიღო ქვა \((\d+) ასაღები დარჩა\)…$/,
      (m) => `The computer took a tile (${m[1]} left to take)…`],
    [/^ახალი ხელი — (.+)$/, (m) => `New hand — ${one(m[1])}`],
    [/^კომპიუტერს დარჩა (.+)$/, (m) => `The computer has ${m[1]} left`],
    [/^ხელში დარჩა — (.+)$/, (m) => `Left in hand — ${m[1]}`],

    // a name or a word with a count after it
    [/^(.+) \((\d+)\)$/, (m) => `${one(m[1])} (${m[2]})`],

    // the friend dialog puts a game name in front of the same sentence
    [/^(დომინო|ბურა|ჯოკერი) — შექმენი მაგიდა და გაუგზავნე კოდი, ან შედი მეგობრის კოდით$/,
      (m) => `${one(m[1])} — make a table and send the code, or join with a friend's`],
    [/^შენ გახსენი \[(.+)\]$/, (m) => `You opened with [${m[1]}]`],
    [/^კომპიუტერმა გახსნა \[(.+)\]$/, (m) => `The computer opened with [${m[1]}]`],
    [/^კომპიუტერს სვლა არ აქვს, იღებს ბაზრიდან…$/,
      () => "The computer has no move and is drawing…"],
    [/^სვლა არ გაქვს\. აირჩიე ქვა \((\d+) ასაღები, ბოლო 2 რჩება\)\.$/,
      (m) => `You have no move. Take a tile (${m[1]} to take, the last two stay).`],
    [/^\[(.+)\], მაინც არ ჯდება — აიღე კიდევ \((\d+) ასაღები დარჩა\)…$/,
      (m) => `[${m[1]}] still does not fit — take another (${m[2]} left)…`],
    [/^ორივეს თანაბარი ქულა დარჩა \((\d+)\)$/, (m) => `Both are left holding the same (${m[1]})`],
    [/^(\d+) ნაკლები დარჩა \((\d+) — (\d+)\)$/, (m) => `${m[1]} fewer left (${m[2]} — ${m[3]})`],
    /* A move that scored says so in a span of its own, so the sentence before
       it ends in a dash and nothing else. */
    [/^კომპიუტერმა ითამაშა \[(.+)\] —$/, (m) => `The computer played [${m[1]}] —`],
    [/^შენ ითამაშე \[(.+)\] —$/, (m) => `You played [${m[1]}] —`],
    [/^აიღე \[(.+)\] —$/, (m) => `You took [${m[1]}] —`],
    [/^\+(\d+) ქულა!$/, (m) => `+${m[1]} points!`],
    [/^(\d+) ქულა$/, (m) => `${m[1]} points`],
    [/^(\d+) ქულა\.$/, (m) => `${m[1]} points.`],
    // the way back to a table, built from a game name and how it stands
    [/^(დომინო|ბურა|ჯოკერი)( · 4 მოთამაშე)? — თამაში მიდის$/,
      (m) => `${one(m[1])}${m[2] ? " · 4 players" : ""} — in play`],
    [/^(დომინო|ბურა|ჯოკერი)( · 4 მოთამაშე)? — მაგიდა ველოდება$/,
      (m) => `${one(m[1])}${m[2] ? " · 4 players" : ""} — still filling`],
  ];

  let lang = null;
  try { lang = localStorage.getItem(STORE); } catch (e) { /* private mode */ }
  if (lang !== "en" && lang !== "ka") lang = "ka";

  /* The translation of one string, or the string itself. Leading and trailing
     space is kept, because plenty of these sit between other words. */
  function one(text) {
    if (lang !== "en" || !text || !KA.test(text)) return text;
    const lead = text.match(/^\s*/)[0], tail = text.match(/\s*$/)[0];
    /* A paragraph written across three lines of HTML arrives with the line
       breaks still in it. What is looked up is the sentence, so the spaces
       inside are squeezed first — and the English that comes back is one
       line, which is what a paragraph wanted anyway. */
    const core = text.trim().replace(/[\s\u00a0]+/g, " ");
    if (EN[core] !== undefined) return lead + EN[core] + tail;
    for (const [re, fn] of PATTERNS) {
      const m = core.match(re);
      if (m) return lead + fn(m) + tail;
    }
    /* Nothing matched the whole of it, so it stays Georgian. Swapping the
       words it happens to contain was tried and is worse than useless here:
       Georgian glues its endings on, so "ცოცხალ მოწინააღმდეგესთან" came out as
       "ცოცხალ Opponentსთან". A sentence is translated whole or not at all. */
    return text;
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
