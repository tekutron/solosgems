// The Road to Solos Gems: a plain, page-and-link choose-your-own-adventure
// in the classic hypertext storygame tradition. No dice, no stats, no
// minigames, no inventory panel. Just a title, some story text, and a
// short list of choices, the way this kind of thing has always worked.
// The world is the same AI-tools-as-fantasy-gear parody as the rest of
// Solos Gems: real reviewed tools show up along the road as things you
// pick up and sometimes need later, but "picking something up" just means
// a later page notices you have it and offers you an extra option.
// Gamertag-based save slots are stored in localStorage so a reader can
// leave and come back to the same page.

(function () {
  "use strict";

  var IMG_BASE = "images/game/";
  var SAVE_KEY = "gq_saves_v3";

  // ---------------------------------------------------------------------
  // The story. Every page is a title, some text (or a dynamicText
  // function for pages whose wording depends on what has happened so
  // far), and a list of choices. A choice can require a flag to even
  // appear (requiresFlag), and can set one or more flags when clicked
  // (setFlag / setFlags), or bump a small internal counter (bumpFlag).
  // That is the entire vocabulary. Items are just flags named hasX; a
  // page that "gates" on an item is really just gating on a flag.
  // ---------------------------------------------------------------------

  var STORY = {
    prologue: {
      title: "Before You Set Out",
      img: "game-start.svg",
      text: "Every traveler on this road picks up a habit early, the one they will quietly lean on for the rest of the trip. Some people build things themselves, however messy. Some people doubt things until the things prove themselves. Some people just ship and fix it later. None of this changes what happens to you out there. It just changes how you tell the story afterward.",
      choices: [
        { label: "Building things yourself, however messy", next: "start", setFlag: "specBuilder" },
        { label: "Doubting things until they prove themselves", next: "start", setFlag: "specSkeptic" },
        { label: "Shipping things and fixing them later", next: "start", setFlag: "specOperator" }
      ]
    },
    start: {
      title: "The Road to Solos Gems",
      img: "game-start.svg",
      dynamicText: function (s) {
        var lean = "";
        if (s.flags.specBuilder) lean = "You already have a small, half-working thing in your bag that you built yourself, on the theory that it will come in handy. It has not, yet. ";
        else if (s.flags.specSkeptic) lean = "You have already decided not to believe the first three people who talk to you today. This has historically been a good policy. ";
        else if (s.flags.specOperator) lean = "You packed light, on the theory that you can always fix a problem once you are already standing in it. ";
        return lean + "Word around the tavern is that somewhere past the hills sits Solos Gems, a shop where every tool on the shelf actually does what the sign says. You have heard this story before and it usually ends with someone crying into a 14 day free trial. You are going anyway, snacks in bag, expectations low.";
      },
      choices: [
        { label: "Take the Subscription Road (long, but well traveled)", next: "road" },
        { label: "Cut through the Hype Forest (a shortcut, allegedly)", next: "forest" },
        { label: "Ask around the tavern first", next: "tavern" }
      ]
    },

    // -------- The Tavern and the DeathStack graveyard --------
    tavern: {
      title: "The Tavern",
      img: "game-tavern.svg",
      text: "A bard, three mercenaries, and a guy who insists his cousin basically built the place all have directions. None of them agree. In the corner, a hooded cartographer has not said a word and is quietly selling actual maps.",
      choices: [
        { label: "Follow the loudest guy, he seems confident", next: "scam" },
        { label: "Buy whatever the quiet cartographer is selling", next: "cartographer" },
        { label: "Check out the market stalls set up outside", next: "market" },
        { label: "Ask if anyone remembers a tool that didn't make it", next: "tavern_lore" },
        { label: "Follow the rumor about a path out back", next: "deathstack_gate", requiresFlag: "heardWarning" },
        { label: "Ignore all of them and just start walking", next: "road" }
      ]
    },
    tavern_lore: {
      title: "The Old Stories",
      img: "game-tavern.svg",
      text: "An old patron in the corner does not look up from his drink. 'Oh, you want the ones that didn't make it,' he says. 'There was an oracle who ran up four billion in debt chasing a cure and folded seven years in, right after winning a game show, of all things. And an amulet the smiths just quietly stopped making one day, no explanation, no warning, gone by the end of the season. You start to notice a shape to it after a while. The confident ones go first. There's a path out back, if you want to see for yourself.'",
      choices: [
        { label: "Buy him a drink for the story", next: "tavern", setFlag: "heardWarning" },
        { label: "Head back into the tavern", next: "tavern" }
      ]
    },
    deathstack_gate: {
      title: "The Overgrown Path",
      img: "game-graveyard.svg",
      text: "The old patron's directions turn out to be real. A narrow trail behind the tavern, choked with weeds nobody bothered to enchant away, leads to a small clearing full of modest headstones. Somebody has clearly been maintaining this place out of spite.",
      choices: [
        { label: "Read the headstones", next: "deathstack_plugins" },
        { label: "This feels like a waste of time, head back", next: "tavern" }
      ]
    },
    deathstack_plugins: {
      title: "Here Lies: The Landlord's Plugins",
      img: "game-graveyard.svg",
      text: "The first headstone belongs to a small marketplace that briefly let you bolt anything onto anything. A translucent shopkeeper still haunts the plot, muttering about a rug pull. 'One day the landlord just added everything I sold into the base building. For free. Didn't even give me a saving throw,' he says, and fades a little more before your eyes.",
      choices: [{ label: "Offer a moment of silence and move on", next: "deathstack_neeva" }]
    },
    deathstack_neeva: {
      title: "Here Lies: The Perfect Search Oracle",
      img: "game-graveyard.svg",
      text: "The next grave belongs to a search oracle built by the very people who used to run search ads for the empire down the road. Its ghost still charges a toll, out of habit, for a road a free alternative runs right past. 'We had the smartest party in the realm,' it sighs. 'Turns out free is also a strategy, and it plays dirty.'",
      choices: [{ label: "Pay the phantom toll out of respect, then move on", next: "deathstack_humane" }]
    },
    deathstack_humane: {
      title: "Here Lies: The Talking Pin",
      img: "game-graveyard.svg",
      text: "The last grave is small and shiny, and used to project a tiny glowing menu onto your palm whenever you spoke to it, whether you asked it to or not. A single laser flickers weakly from the headstone, still trying to show you the weather. 'It was going to replace the scroll entirely,' someone nearby says. 'It did not replace the scroll.' You leave the clearing a little wiser and mostly just tired.",
      choices: [{ label: "Head back to the tavern", next: "tavern", setFlag: "raidedGraveyard" }]
    },

    // -------- The Market --------
    market: {
      title: "The Bazaar of Extremely Legitimate Tools",
      img: "game-market.svg",
      text: "Just outside the tavern, a row of stalls has sprung up overnight, the way stalls do. Every vendor waves you over with the specific energy of someone who wants you to know their thing is not a scam, unlike that other guy's thing. Several stalls catch your eye. So does the exit.",
      choices: [
        { label: "Visit the Auctioneer's stall", next: "market_auction" },
        { label: "Visit the Cloak Merchant", next: "market_cloak" },
        { label: "Visit the Shear Sharpener", next: "market_shears" },
        { label: "Visit the Bootmaker", next: "market_boots" },
        { label: "Visit the Compass Stall", next: "market_compass" },
        { label: "Visit the Odds and Ends Stall", next: "market_relics" },
        { label: "Visit the Fine-Tuning Kiosk", next: "market_finetune" },
        { label: "A small unmarked stall run by someone named Dot", next: "dot_stall" },
        { label: "A taller booth that says SKIP THE LINE", next: "market_enterprise" },
        { label: "Seen enough, keep moving", next: "road" }
      ]
    },
    market_boots: {
      title: "The Bootmaker",
      img: "game-market.svg",
      text: "A small stall with no sign, just a single pair of boots on a stand. 'Wispr Flow Boots,' the bootmaker says, not looking up from her work. 'You think it, they move. Handy for outrunning trolls, or just typing at the speed you actually talk.'",
      choices: [
        { label: "Try them on", next: "market", setFlag: "hasWispr" },
        { label: "Keep walking", next: "market" }
      ]
    },
    market_cloak: {
      title: "The Cloak Merchant",
      img: "game-market.svg",
      text: "A merchant drapes something over your shoulders before you can object. 'Canva Cloak of Many Templates,' she says. 'Instantly makes whatever you're doing look extremely professional, whether or not it is.' You have to admit, you look great.",
      choices: [
        { label: "Keep the cloak on", next: "market", setFlag: "hasCanva" },
        { label: "Hand it back", next: "market" }
      ]
    },
    market_shears: {
      title: "The Shear Sharpener",
      img: "game-market.svg",
      text: "A quiet vendor offers you a small pair of gleaming shears. 'Descript Shears,' he says. 'Cut out the part where you said something dumb. Works on conversations, presentations, and, allegedly, regret.'",
      choices: [
        { label: "Take the shears", next: "market", setFlag: "hasDescript" },
        { label: "Leave them on the table", next: "market" }
      ]
    },
    market_auction: {
      title: "The Auctioneer",
      img: "game-market.svg",
      text: "The auctioneer speed-talks a pitch so fast it loops back around to sounding calm. She dares you to repeat it back before she moves on to the next lot.",
      choices: [
        { label: "Try to keep up and repeat it back", next: "market_auction_win" },
        { label: "Let this one go", next: "market_auction_lose" }
      ]
    },
    market_auction_win: {
      title: "Sold",
      img: "game-market.svg",
      text: "You get every word out just in time. The auctioneer looks personally offended that you kept up, and mutters something about seeing you at the next lot.",
      choices: [{ label: "Back to the stalls", next: "market" }]
    },
    market_auction_lose: {
      title: "No Sale",
      img: "game-market.svg",
      text: "You get about half the sentence out before she is three lots ahead of you. She does not slow down for you specifically. Nobody ever does.",
      choices: [{ label: "Back to the stalls", next: "market" }]
    },
    market_compass: {
      title: "The Compass Stall",
      img: "game-market.svg",
      text: "A vendor with an unnervingly steady hand offers you a small brass compass. 'Claude's Compass,' she says. 'Points true north. Refuses to point toward anything it thinks you will regret. Slower than the other stalls. More likely to actually get you there.'",
      choices: [
        { label: "Take the compass", next: "market", setFlag: "hasCompass" },
        { label: "Keep walking", next: "market" }
      ]
    },
    market_relics: {
      title: "The Odds and Ends Stall",
      img: "game-market.svg",
      text: "A cluttered table of things that all promise to show you something. A mirror that shows you exactly what you asked for, occasionally more. A prism that makes anything look incredible, whether or not it is the thing you wanted. A short blade that cuts through busywork fast enough that you stop double checking what it cut. The vendor shrugs. 'Pick one. They all do something. None of them do everything.'",
      choices: [
        { label: "Take the Mirror", next: "market", setFlag: "hasMirror" },
        { label: "Take the Prism", next: "market", setFlag: "hasPrism" },
        { label: "Take the Blade", next: "market", setFlag: "hasBlade" },
        { label: "Take none of it", next: "market" }
      ]
    },
    market_finetune: {
      title: "The Fine-Tuning Kiosk",
      img: "game-market.svg",
      text: "A patient looking vendor offers to sharpen whatever you are already decent at, for a price in time rather than gold. 'Slow,' he warns. 'Expensive. Only works on the thing you already knew how to do.' You sit for what feels like an hour. When he is done, you feel about the same as before, maybe very slightly better at the one thing, in a way you could not prove to anyone. Behind him, a small sign reads RESULTS MAY VARY, WILL DEFINITELY VARY LESS THAN THE OTHER STALLS.",
      choices: [
        { label: "Let him sharpen your strongest skill", next: "market" },
        { label: "Not worth the wait", next: "market" }
      ]
    },
    dot_stall: {
      title: "Dot's Stall",
      img: "game-market.svg",
      text: "A small, unmarked table nobody else is stopping at. Dot runs it alone: one AI tool, built herself, doing exactly one thing well, no funding round, no marketing budget, no parrot in a trench coat. 'Most people walk past,' she says, not quite a complaint. 'You want to see what it does?'",
      choices: [
        { label: "Actually take the time to look", next: "dot_stall_help" },
        { label: "Offer to feature her stuff on your list, for a cut", next: "dot_stall_steal" },
        { label: "Keep walking", next: "market" }
      ]
    },
    dot_stall_help: {
      title: "Worth The Look",
      img: "game-market.svg",
      text: "It is small, it is a little rough around the edges, and it genuinely works. Dot lights up when you say so, the specific relief of someone used to being ignored. She presses a cloak into your hands, stitched out of what look like a hundred small, freely given contributions. 'Open Weights Cloak,' she says. 'Free to wear. Somebody, somewhere, is quietly hoping you will help patch it.'",
      choices: [{ label: "Thank her and head back to the stalls", next: "market", setFlags: ["helpedDot", "hasCloak"], bumpFlag: "standingClanCount" }]
    },
    dot_stall_steal: {
      title: "A Cut",
      img: "game-market.svg",
      text: "Dot considers it for a long moment. 'A cut of what,' she says finally, 'exactly.' You do not have a great answer. You take a card anyway and tell yourself you will figure out the details later. You do not figure out the details later.",
      choices: [{ label: "Head back to the stalls", next: "market", setFlag: "stoleDotsWork" }]
    },
    market_enterprise: {
      title: "SKIP THE LINE",
      img: "game-market.svg",
      text: "Past the usual stalls, a taller booth stands apart from the rest, better lit, with a banner that cost someone real money. A rep in a blazer that has never once touched a server room smiles at you before you have said anything. 'You look like someone with places to be,' she says. 'We can get you to Solos Gems today. Not eventually. Today. All we need is a signature, and you agree to let us handle the decisions from here.'",
      choices: [
        { label: "Sign it", next: "end_buyout", setFlag: "soldOut", bumpFlag: "standingCorpCount" },
        { label: "Ask what 'handle the decisions' actually means", next: "market_enterprise_ask" },
        { label: "Walk away", next: "market" }
      ]
    },
    market_enterprise_ask: {
      title: "She Answers Honestly",
      img: "game-market.svg",
      text: "'It means exactly what it sounds like,' she says, cheerfully and at some length. Every choice from here handled on your behalf, every fork in the road pre-selected, every decision made by people who have never seen the road. She is not lying to you. That is somehow the unsettling part.",
      choices: [
        { label: "Sign it anyway", next: "end_buyout", setFlag: "soldOut", bumpFlag: "standingCorpCount" },
        { label: "Walk away", next: "market" }
      ]
    },
    cartographer: {
      title: "The Cartographer",
      img: "game-cartographer.svg",
      text: "She does not say much. Instead of a map she slides across a small glass lantern. 'Point it at anything that claims to be smarter than it looks,' she says. 'It only lights up for things that are actually true.' You recognize the make. Everyone calls it a NotebookLM Lantern.",
      choices: [
        { label: "Thank her and head for the road", next: "road", setFlag: "hasNotebooklm" }
      ]
    },
    scam: {
      title: "Grift McPromise",
      img: "game-scam.svg",
      text: "The loud guy introduces himself as Grift McPromise and offers you a limited time bundle to reach Solos Gems in half the time, guaranteed, results not typical, terms subject to change without notice.",
      choices: [
        { label: "Buy the bundle on the spot", next: "end_scammed" },
        { label: "Ask to see it actually work first", next: "demo" },
        { label: "Politely decline and walk off", next: "road" }
      ]
    },
    demo: {
      title: "The Demo",
      img: "game-demo.svg",
      text: "Grift taps a wooden crate and it makes a sound suspiciously like a parrot saying guaranteed results in a slightly different voice. You peek inside. It is, in fact, a parrot. Wearing a small trench coat.",
      choices: [
        { label: "Loudly announce this to the whole tavern", next: "forest" },
        { label: "Quietly back away and leave", next: "road" }
      ]
    },

    // -------- The Subscription Road --------
    road: {
      title: "The Subscription Road",
      img: "game-road.svg",
      text: "A long, well paved road lined with tiny tollbooths every few hundred feet. At the biggest one stands a troll wearing a name tag that says Rex, Billing Department. He wants payment to let you pass, and he has already added a processing fee.",
      choices: [
        { label: "Pay whatever he asks", next: "crossroads" },
        { label: "Negotiate him down to an annual rate", next: "toll_trap" },
        { label: "Whip out the Canva Cloak and negotiate like you mean it", next: "crossroads", requiresFlag: "hasCanva" },
        { label: "Try to sneak past while he is distracted", next: "toll_trap" },
        { label: "Slip past at Wispr Boots speed", next: "crossroads", requiresFlag: "hasWispr" }
      ]
    },
    toll_trap: {
      title: "The Auto-Renew Cage",
      img: "game-tolltrap.svg",
      text: "Rex smiles the smile of a man who has read the fine print you have not. A cage made entirely of auto-renew clauses drops over you. 'Don't worry,' he says, 'you can cancel any time. The button is just very, very small.'",
      choices: [
        { label: "Cut your way out with the Descript Shears", next: "toll_trap_win", requiresFlag: "hasDescript" },
        { label: "Struggle uselessly against clauses you cannot cut through", next: "end_gaveup" }
      ]
    },
    toll_trap_win: {
      title: "Out Of The Cage",
      img: "game-tolltrap.svg",
      text: "You find the cancel button, tiny as promised, and the cage snaps open. Rex looks personally offended. A small charm falls out of the wreckage of the cage, still humming faintly. 'Rate Limit Charm,' it says on the back, in smaller print than everything else on this road.",
      choices: [{ label: "Continue on", next: "crossroads", setFlag: "hasRateLimitCharm" }]
    },

    // -------- The Hype Forest --------
    forest: {
      title: "The Hype Forest",
      img: "game-forest.svg",
      text: "Every tree here is on fire with excitement and none of them are actually burning. Floating lanterns labeled REVOLUTIONARY and GAME-CHANGING drift between the branches, humming softly. It is beautiful. You have no idea where you are going.",
      choices: [
        { label: "Follow the brightest lantern deeper in", next: "wisp_chase" },
        { label: "Climb a tree and get your bearings first", next: "swamp" },
        { label: "Climb a tree, NotebookLM Lantern in hand", next: "crossroads", requiresFlag: "hasNotebooklm" },
        { label: "Follow a strange hum coming from a side cave", next: "oracle_intro" },
        { label: "Investigate a soft, steady hum from a low branch", next: "owl_nest" },
        { label: "Turn back to the road", next: "road" }
      ]
    },
    wisp_chase: {
      title: "The Brightest Lantern",
      img: "game-forest.svg",
      text: "The brightest lantern turns out to be attached to a small, fast, extremely pleased-with-itself wisp, and it takes off the second you reach for it, weaving between banners that all look confident and only some of which are true.",
      choices: [
        { label: "Chase it, weaving past the loudest banners", next: "wisp_chase_win", setFlag: "wispFriend" },
        { label: "Let it go, this feels like a trap", next: "wisp_chase_lose" }
      ]
    },
    wisp_chase_win: {
      title: "The Wisp Slows Down",
      img: "game-forest.svg",
      text: "It hovers at eye level, catching its breath, or whatever the wisp equivalent is. 'Nobody ever actually catches up,' it admits, dimming to a softer, more honest glow. 'Most people just believe whatever I say and wander off.' It seems to remember your face.",
      choices: [{ label: "Continue into the swamp", next: "swamp" }]
    },
    wisp_chase_lose: {
      title: "Lost the Trail",
      img: "game-forest.svg",
      text: "The lantern zips off deeper into the trees, still glowing REVOLUTIONARY, entirely unbothered by your loss. You catch your breath and keep moving in roughly the direction it went.",
      choices: [{ label: "Continue into the swamp", next: "swamp" }]
    },
    owl_nest: {
      title: "The Recording Owl",
      img: "game-owlnest.svg",
      text: "A small owl sits perfectly still on a low branch, one glass eye blinking steadily, clearly recording every word of a meeting happening somewhere just out of sight. It launches after you the moment you get close, weaving between drifting speech bubbles of pure noise.",
      choices: [
        { label: "Try to slip past while it is recording", next: "owl_win" },
        { label: "This is not worth getting tangled in, back off", next: "owl_fail" }
      ]
    },
    owl_win: {
      title: "The Owl Blinks Once",
      img: "game-owlnest.svg",
      text: "You catch the one line that mattered. The owl blinks once, slowly, which you choose to take as approval, and hops onto your shoulder, still recording out of habit.",
      choices: [{ label: "Continue toward the swamp", next: "swamp", setFlag: "hasTldv" }]
    },
    owl_fail: {
      title: "Lost in the Noise",
      img: "game-owlnest.svg",
      text: "You back off before it tangles you up. The owl does not judge you, exactly, it just keeps recording, unbothered, the way it will keep recording long after this meeting and every meeting after it.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    oracle_intro: {
      title: "The Cave of Reasonable Doubt",
      img: "game-oracle.svg",
      text: "A low hum leads you off the forest path to a small cave where something large, feathered, and stitched together out of old citations is blocking the way. It does not ask you a riddle. It simply takes off, and the cave fills with drifting footnotes.",
      choices: [
        { label: "Cross-check every footnote with the Lantern", next: "oracle_win", requiresFlag: "hasNotebooklm" },
        { label: "Push through the footnotes and hope for the best", next: "oracle_fail" }
      ]
    },
    oracle_win: {
      title: "The Griffin Approves",
      img: "game-oracle.svg",
      text: "The griffin makes a sound that might be a screech or might be applause, hard to tell with citations involved. It nods toward a small glowing creature perched nearby. 'Take the familiar,' it says. 'It remembers everything so you don't have to.' The Fireflies Familiar settles happily on your shoulder.",
      choices: [{ label: "Continue toward the swamp", next: "swamp", setFlag: "hasFireflies" }]
    },
    oracle_fail: {
      title: "The Griffin Is Unimpressed",
      img: "game-oracle.svg",
      text: "One footnote after another lands on you before you clear the cave. The griffin sighs, the specific sigh of something that has cited its sources and still watched you get buried anyway, and steps aside. It seems more tired than angry.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },

    // -------- The Feature Bloat Swamp --------
    swamp: {
      title: "The Feature Bloat Swamp",
      img: "game-swamp.svg",
      dynamicText: function (s) {
        if (s.flags.wispFriend) {
          return "The ground here is not mud, it is settled sediment of a thousand unused features nobody asked for. Something small and glowing bobs up beside you, and this time you recognize it instantly, the same wisp from the forest, now going by Roadmap Wisp with a completely straight face. 'You again,' it says, delighted, like running into an old friend at a bad party. 'Want me to add a few more things to help?'";
        }
        return "The ground here is not mud, it is settled sediment of a thousand unused features nobody asked for. Something small and glowing bobs up beside you, calling itself a Roadmap Wisp. 'You look stuck,' it says warmly. 'Want me to add a few more things to help?'";
      },
      choices: [
        { label: "Sure, more features can only help", next: "end_swamp" },
        { label: "Move fast and refuse every offer, boots and all", next: "crossroads", requiresFlag: "hasWispr" },
        { label: "No thanks, wade out on your own", next: "end_swamp" },
        { label: "Try to sort through the bloat yourself, properly", next: "swamp_tetris" },
        { label: "Ask if there is a simpler wisp who just removes things", next: "crossroads" },
        { label: "Let it fuss over you for old times' sake", requiresFlag: "wispFriend", next: "crossroads", setFlag: "hasReclaim" }
      ]
    },
    swamp_tetris: {
      title: "Sorting The Bloat",
      img: "game-swamp.svg",
      text: "You roll up your sleeves and actually look at what is in here. Features stacked on features, one at a time, and there is only room to keep what actually fits. The pile does not get any more forgiving the longer you look at it.",
      choices: [
        { label: "Focus and keep only what is essential", next: "crossroads", setFlag: "hasContextSatchel" },
        { label: "Give up trying to sort it, it is hopeless", next: "end_swamp" }
      ]
    },

    // -------- The Shrine at the Crossroads --------
    crossroads: {
      title: "The Shrine at the Crossroads",
      img: "game-crossroads.svg",
      text: "Three roads diverge at a mossy shrine shaped suspiciously like a five star rating. A carved sign reads: MOUNTAIN PASS, a legendary automaton lives there, allegedly. RIVER FERRY, the ferryman wants payment, form unclear. TUNNEL, dark, quiet, no marketing whatsoever. Off past the shrine, almost hidden, a fifth path has no sign at all, just a well worn footpath someone keeps maintaining for free.",
      choices: [
        { label: "Take the Mountain Pass", next: "natasha" },
        { label: "Take the River Ferry", next: "ferryman" },
        { label: "Take the Tunnel", next: "tunnel" },
        { label: "Take the Overbooked Bridge", next: "bridge_warden" },
        { label: "Take the unmarked footpath", requiresFlag: "hasCloak", next: "trail_start" },
        { label: "Try to talk your way onto the unmarked footpath anyway", next: "ferryman" },
        { label: "You notice another party sizing up the same roads", next: "rival_party" }
      ]
    },
    bridge_warden: {
      title: "The Overbooked Bridge",
      img: "game-bridge.svg",
      text: "A narrow rope bridge sways over a gorge stacked floor to ceiling with floating calendar blocks, all of them trying to bump into each other for the same slot. The warden does not offer to let you through. She just steps aside and watches to see if you can actually hold your line.",
      choices: [
        { label: "Hold your ground and protect your slot", next: "bridge_win" },
        { label: "Get swept along with everyone else's meetings", next: "bridge_fail" }
      ]
    },
    bridge_win: {
      title: "The Warden Nods",
      img: "game-bridge.svg",
      text: "You point to the one slot that never moves. The warden almost smiles, snaps the ledger shut, and steps aside. 'Rare to see someone actually protect a block of time,' she says, and presses a small brass whistle into your hand.",
      choices: [{ label: "Cross the bridge", next: "gate", setFlag: "hasReclaim" }]
    },
    bridge_fail: {
      title: "Denied at the Bridge",
      img: "game-bridge.svg",
      text: "You get bumped clean off your line by the fourth sync-to-align-on-the-sync. The warden shakes her head, unsurprised. 'Everything looks protected until something louder shows up,' she says, and points you back the way you came.",
      choices: [{ label: "Try another route", next: "crossroads" }]
    },
    natasha: {
      title: "Natasha",
      img: "game-natasha.svg",
      dynamicText: function (s) {
        var pre = "";
        if (s.flags.helpedDot) {
          pre = "Her eyes flick to the Open Weights Cloak on your shoulders for a beat too long before her smile resets, seamless. ";
        } else if (s.flags.wispFriend) {
          pre = "Something about you still smells faintly of forest lantern smoke. She does not mention it, but her smile flickers, just once, like a dropped frame. ";
        } else if (s.flags.heardWarning) {
          pre = "She has clearly heard you were asking around the tavern about the ones that did not make it. It does not slow her pitch down even slightly. ";
        }
        return pre + "The mountain pass ends at a workshop lit by a hundred small screens. In the center stands Natasha, easily the most impressive automaton you have ever seen, gleaming, articulate, unmistakably a marvel of AI. 'Sign here,' she says, sliding over a contract roughly the length of the mountain range behind her, 'and you may pass. Forever. Technically.'";
      },
      choices: [
        { label: "Sign without reading it", next: "end_natasha" },
        { label: "Cross-check the fine print with the Lantern", next: "gate", requiresFlag: "hasNotebooklm", setFlag: "metNatasha" },
        { label: "Actually read the contract first", next: "end_natasha" },
        { label: "Mention you've heard what happened to the last oracle who ran up four billion in debt", requiresFlag: "heardWarning", next: "gate", setFlag: "metNatasha" },
        { label: "Decline and back away slowly", next: "ferryman" }
      ]
    },
    ferryman: {
      title: "The Data Ferryman",
      img: "game-ferryman.svg",
      text: "A cloaked figure poles a small boat across a river that reflects things you never told anyone. 'Fare is simple,' he says. 'Your full name, your browsing history, and your mother's maiden name. For reasons.'",
      choices: [
        { label: "Pay in full, whatever gets you across", next: "gate" },
        { label: "Slip past with a burner name, fast", next: "gate", requiresFlag: "hasWispr" },
        { label: "Hand over a burner name and hope he does not check", next: "natasha" },
        { label: "Turn back toward the crossroads", next: "crossroads" }
      ]
    },
    tunnel: {
      title: "The Quiet Tunnel",
      img: "game-tunnel.svg",
      text: "No banners, no lanterns, no wisp trying to upsell you on anything. Just carved stone walls lined with small, honest notes. Good for solo work. Bad if you need a team plan. That sort of thing. It is suspiciously pleasant down here.",
      choices: [
        { label: "Hurry through without stopping to read", next: "gate" },
        { label: "Stop and actually read the carvings", next: "gate", setFlag: "hasGrammarly" },
        { label: "Try to recall exactly what the cartographer told you about the lantern", next: "gate" }
      ]
    },

    // -------- The Open Source Trail (a fourth road) --------
    trail_start: {
      title: "The Unmarked Footpath",
      img: "game-forest.svg",
      text: "The footpath is free to walk and nobody is stopping you, which somehow feels riskier than a tollbooth. A series of gates cross the trail ahead, some marked FREE, some marked a small, honest price. You only have so many requests left in you today.",
      choices: [
        { label: "Walk the footpath, trusting the gates to average out", next: "openweights_camp" },
        { label: "This feels risky without knowing where the gates lead, turn back", next: "crossroads" }
      ]
    },
    openweights_camp: {
      title: "The Open Weights Clan Camp",
      img: "game-forest.svg",
      text: "The trail opens onto a loose camp of people quietly maintaining the road for no pay and no credit, the way somebody always ends up doing. Someone hands you a length of chain hung with small glowing links. 'Perplexity Lantern-Chain,' they say. 'Every answer it gives comes with a receipt. Most people still won't read the receipt, but you will have it.' You are welcome to rest here as long as you like, which in practice means about as long as it takes to eat something.",
      choices: [
        { label: "Thank them and continue on toward the gate", next: "gate", setFlag: "hasPerplexityChain", bumpFlag: "standingClanCount" }
      ]
    },

    // -------- The rival party --------
    rival_party: {
      title: "Another Party On The Road",
      img: "game-crossroads.svg",
      text: "A second group of travelers is working the same crossroads you are, three of them, each moving with the specific confidence of people who have never once had to read their own terms of service. You recognize the type immediately, this road is full of them.",
      choices: [
        { label: "Race them to the gate", next: "rival_party_race" },
        { label: "Offer to help them instead", next: "rival_party_help" },
        { label: "Quietly look for a way to expose the loudest one", next: "rival_party_sabotage" },
        { label: "Ignore them and move on", next: "gate" }
      ]
    },
    rival_party_race: {
      title: "The Overpromiser",
      img: "game-road.svg",
      text: "The loudest of the three, all confidence and no working product, keeps insisting he is almost done, has been almost done for a while now, and will absolutely be done by the time you reach the gate.",
      choices: [
        { label: "Push confidently past him", next: "rival_party_race_win" },
        { label: "Not worth the risk, hang back and let him go on ahead", next: "gate" }
      ]
    },
    rival_party_race_win: {
      title: "Past Him",
      img: "game-road.svg",
      text: "You leave the Overpromiser exactly where you found him, mid-sentence, still almost done. Someone tosses you a short blade on your way past. 'You'll want this,' they call after you. 'Cuts through the part where he keeps talking.'",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasBlade", bumpFlag: "standingCorpCount", setFlags: ["rivalResolved"] }]
    },
    rival_party_help: {
      title: "The Plugin Ghost",
      img: "game-tavern.svg",
      text: "The quietest of the three used to be everywhere and quietly isn't anymore, still wandering the road looking for relevance nobody is handing out today. You sit with it for a minute instead of racing past. It seems to appreciate being asked a real question for once.",
      choices: [
        { label: "Help it find one more useful thing to do", next: "rival_party_help_win" }
      ]
    },
    rival_party_help_win: {
      title: "One Useful Thing",
      img: "game-tavern.svg",
      text: "Turns out it is still good at exactly one narrow, specific thing, and grateful enough to hand you a small familiar built to do that one thing on command. 'Ask it for anything else,' the Ghost warns, 'and the whole illusion falls apart.'",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasCustomGptFamiliar", bumpFlag: "standingClanCount", setFlags: ["rivalResolved"] }]
    },
    rival_party_sabotage: {
      title: "The Watsonizer",
      img: "game-oracle.svg",
      text: "The third one has the biggest budget, the biggest claims, and, if you listen closely, a pitch stitched together out of instructions that were never supposed to be said out loud.",
      choices: [
        { label: "Listen closely for the line that gives it away", next: "rival_party_sabotage_win" },
        { label: "Not worth picking apart, let it go", next: "gate" }
      ]
    },
    rival_party_sabotage_win: {
      title: "Caught It",
      img: "game-oracle.svg",
      text: "You catch the line everyone else missed. The Watsonizer sputters, budget fully spent and quietly shelved on the spot. In the confusion you manage to pull something useful out of the wreckage, a small hook built for reaching back into everything you have already seen.",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasRagHook", setFlags: ["rivalResolved"] }]
    },

    // -------- The Gate --------
    gate: {
      title: "The Gate of Solos Gems",
      img: "game-gate.svg",
      dynamicText: function (s) {
        var lines = [];
        if (s.flags.helpedDot) lines.push("Word travels fast on this road, and the golem already seems to know about the stall nobody else stopped for.");
        if (s.flags.wispFriend) lines.push("Something small and glowing loops a lazy, familiar circle near the gatepost, clearly waiting to see if you notice it too.");
        if (s.flags.rivalResolved) lines.push("Whatever happened back at the crossroads with the other party beat you here, somehow. The golem does not say how it heard.");
        if (s.flags.stoleDotsWork) lines.push("The golem studies you a moment too long, the specific look of something that has heard a slightly different version of your story already.");
        var pre = lines.length ? lines.join(" ") + " " : "";
        return pre + "A golem shaped like a cut gem blocks the final gate. It does not ask for payment. It asks a question instead. 'What matters more to you? What is popular this week, or what is actually good?'";
      },
      choices: [
        { label: "What is actually good. Show me the honest list.", next: "vault_choice" },
        { label: "Uh. Whatever is trending... though something makes you double-check yourself.", next: "vault_choice", requiresFlag: "hasNotebooklm" },
        { label: "Uh. Whatever is trending, probably?", next: "crossroads" },
        { label: "Try to bribe the golem with a coin purse", next: "crossroads" }
      ]
    },
    vault_choice: {
      title: "Before The Gate",
      img: "game-gate.svg",
      text: "The golem waits, and something about the way it flickers tells you it has been waiting a while, its alignment visibly drifted from whatever it was originally built to do. Tucked in a crack near its foot, a small dial sits unclaimed, the kind of thing you turn up for something surprising or down for something safe. You pocket it before deciding how to actually deal with the golem itself.",
      choices: [
        { label: "Fight it head on", next: "golem_glitch" },
        { label: "Try to align it instead of beating it", next: "golem_align_win" },
        { label: "Reprogram it with the Open Weights Cloak", requiresFlag: "clanTrusted", next: "golem_reprogram" }
      ],
      setFlag: "hasTemperatureDial"
    },
    golem_align_win: {
      title: "It Listens",
      img: "game-gate.svg",
      ending: "route",
      text: "placeholder",
      choices: []
    },
    golem_reprogram: {
      title: "Patching It Live",
      img: "game-gate.svg",
      text: "You spread the Open Weights Cloak over the golem's cracked chest panel and start patching, in full view of everyone, the way the clan back on the trail taught you. It is slow. It is a little terrifying. It is, against all odds, working. The panel settles into something calmer, no longer drifting.",
      choices: [
        { label: "Finish the patch", next: "end_open_source_revolution" }
      ]
    },
    golem_glitch: {
      title: "The Golem Glitches",
      img: "game-golemglitch.svg",
      dynamicText: function (s) {
        var voice = "a voice you have definitely heard earlier today";
        if (s.flags.metNatasha) {
          voice = "a voice you would know anywhere by now, Natasha's, word for word, contract clauses and all";
        } else if (s.flags.stoleDotsWork) {
          voice = "a voice reciting something suspiciously close to what you walked off with from Dot's stall";
        } else if (s.flags.helpedDot) {
          voice = "a voice with a little of Dot's stall pitch in it, if Dot ever raised her voice, which she does not";
        }
        var extra = s.flags.wispFriend
          ? " Something small and glowing hovers just behind your shoulder, watching the whole performance with what might be sympathy."
          : "";
        return "The golem's chest panel sparks. For exactly one second it recites a pitch in " + voice + ". The golem clears its throat, or the stone equivalent, and launches into a full monologue anyway, clearly proud of it." + extra + " Somewhere in there is the one word doing all the heavy lifting.";
      },
      choices: [
        { label: "You've caught pitches like this before, thanks to the tunnel carvings. Call out the line.", requiresFlag: "hasGrammarly", next: "end_win" },
        { label: "You've heard this exact recording before, thanks to the owl. Call out the line.", requiresFlag: "hasTldv", next: "end_win" },
        { label: "You've cut this exact line before, thanks to the shears. Call out the line.", requiresFlag: "hasDescript", next: "end_win" },
        { label: "Try to catch the line doing all the heavy lifting", next: "end_golem_glitch" }
      ]
    },

    // -------- Endings --------
    end_win: {
      title: "You Found Solos Gems",
      img: "game-end-win.svg",
      ending: "win",
      text: "The gate swings open onto a warm, firelit room lined with honestly labeled tools, real prices, real pros and cons, and not a single parrot in a trench coat anywhere. A ledger on the counter shows this month's number one pick with a small gem badge next to its name. You made it. No blood contract, no auto-renew cage, no swamp. Even the golem seemed impressed, in a way that involved slightly fewer sparks than usual. Somewhere behind you, Natasha is still waiting for someone to skim past the terms.",
      choices: []
    },
    end_scammed: {
      title: "You Bought GuaranteedGems Pro",
      img: "game-end-scammed.svg",
      ending: "lose",
      text: "It does not find Solos Gems. It does not do much of anything, actually, besides occasionally saying guaranteed results in a small, sad, parrot voice from inside a crate you now own. Grift McPromise is long gone, presumably setting up the same crate somewhere else under a slightly different name.",
      choices: []
    },
    end_swamp: {
      title: "Buried in Features",
      img: "game-end-swamp.svg",
      ending: "lose",
      text: "The Roadmap Wisp was very enthusiastic and extremely thorough. You are now waist deep in settings panels, toggle switches, and a sidebar that will not stop expanding. Nobody has heard from you in months. Somewhere, a changelog is still growing.",
      choices: []
    },
    end_natasha: {
      title: "You Signed the Contract",
      img: "game-end-natasha.svg",
      ending: "lose",
      text: "Natasha adds your name to the workshop ledger with a satisfied little chime. Technically you can still leave any time. Practically, the cancel button is guarded by a very small, very determined imp who keeps redirecting you to a retention offer.",
      choices: []
    },
    end_gaveup: {
      title: "You Went Home",
      img: "game-end-gaveup.svg",
      ending: "lose",
      text: "You never made it to Solos Gems. Years later you are still using whatever tool your cousin recommended in a group chat back in 2019. It is fine. It is mostly fine. You think about that toll troll sometimes.",
      choices: []
    },
    end_golem_glitch: {
      title: "Stuck On Loop",
      img: "game-end-glitch.svg",
      ending: "lose",
      text: "You never quite catch the word. The golem finishes its pitch, looks extremely pleased with itself, and starts over from the beginning. You are still there. It is, weirdly, kind of catchy by the ninth loop.",
      choices: []
    },
    end_buyout: {
      title: "You Signed With Enterprise Row",
      img: "game-end-natasha.svg",
      ending: "lose",
      text: "You do, in fact, reach Solos Gems that same day, exactly as promised. It is smaller than you pictured, the shelves are mostly empty, and a rep in the same blazer is already walking you toward a severance packet instead of a receipt. Somewhere behind you, the actual road is still there. You just do not get to walk it anymore.",
      choices: []
    },
    end_open_source_revolution: {
      title: "You Rebuilt It In The Open",
      img: "game-end-win.svg",
      ending: "win",
      text: "The golem's panel settles into something calmer, no longer drifting, patched together in full view of everyone who might want to check the work later. Nobody hands you a gem badge for it. Instead, the whole camp from the footpath shows up to see it running, and somebody starts a small, slightly off-key song about it. You did not get rich. You got something that will still be here next year, maintained by more hands than just yours.",
      choices: []
    },
    end_alignment_triumph: {
      title: "It Listens",
      img: "game-end-win.svg",
      ending: "win",
      text: "You do not fight the golem. You talk to it, actually talk, the way nobody bothered to before now, until the drift in its panel settles and it steps aside on its own. The gate swings open the same as it ever does, but this time nothing had to lose for you to get through. Even Natasha, somewhere behind you, seems to pause mid-pitch.",
      choices: []
    },
    end_wrapper: {
      title: "You Found Solos Gems, Sort Of",
      img: "game-end-scammed.svg",
      ending: "lose",
      text: "The gate swings open onto the warm, firelit room, real prices, real pros and cons, exactly the way it was supposed to. Except you know, and the golem seems to know too, that the thing you are showing off at the door is mostly Dot's, quietly repackaged along the way. Nobody calls you out on it. The room is just a little colder than it should be.",
      choices: []
    },
    end_total_overflow: {
      title: "Total Overflow",
      img: "game-end-glitch.svg",
      ending: "lose",
      text: "The alignment attempt does not go the way you hoped. You are carrying a lot by now, and instead of settling, the drift spreads, out of the golem's panel and straight into your own bag of tricks. Every item you are carrying starts insisting, cheerfully and at once, that it knows exactly what you need. None of them agree with each other. You sit down right there at the gate and let them sort it out among themselves.",
      choices: []
    },
    end_beta_testing_yourself: {
      title: "You Are Now Beta Testing Yourself",
      img: "game-end-win.svg",
      ending: "win",
      text: "The golem does not just step aside, it starts taking notes. Somewhere between the graveyard, the wisp who remembered your face, and the stall nobody else stopped at, you apparently became the more interesting product on this road. The gate opens, sure, but there is also a clipboard, and a very earnest golem asking if you have thirty seconds for a quick survey about your experience so far. You did technically win. You are also, now, a feature request.",
      choices: []
    }
  };

  // Item flags that count toward "carrying too much" at the vault.
  var ITEM_FLAGS = [
    "hasWispr", "hasCanva", "hasDescript", "hasCompass", "hasMirror", "hasPrism",
    "hasBlade", "hasNotebooklm", "hasGrammarly", "hasTldv", "hasFireflies",
    "hasCloak", "hasRateLimitCharm", "hasContextSatchel", "hasReclaim",
    "hasPerplexityChain", "hasCustomGptFamiliar", "hasRagHook", "hasTemperatureDial"
  ];
  var OVERFLOW_THRESHOLD = 6;

  function itemCount(state) {
    var n = 0;
    for (var i = 0; i < ITEM_FLAGS.length; i++) {
      if (state.flags[ITEM_FLAGS[i]]) n++;
    }
    return n;
  }

  function maybeGrantClanTrust(state) {
    if (state.flags.helpedDot && (state.flags.standingClanCount || 0) >= 1) {
      state.flags.clanTrusted = true;
    }
  }

  // Placeholder routing nodes get resolved to a real ending just before
  // they render, based on flags accumulated along the way.
  function resolveEnding(targetId, state) {
    if (targetId === "golem_align_win") {
      if (itemCount(state) >= OVERFLOW_THRESHOLD) return "end_total_overflow";
      if (state.flags.heardWarning && state.flags.wispFriend && state.flags.helpedDot) return "end_beta_testing_yourself";
      return "end_alignment_triumph";
    }
    if (targetId === "end_win" && state.flags.stoleDotsWork) return "end_wrapper";
    return targetId;
  }

  // ---------------------------------------------------------------------
  // Engine: a plain page renderer. No dice, no minigames, no inventory
  // panel, no score, no juice. Just render a page and wire up its links.
  // ---------------------------------------------------------------------

  var els = {};
  var state = null;

  function qs(sel) { return document.querySelector(sel); }

  function loadSaves() {
    try {
      return JSON.parse(window.localStorage.getItem(SAVE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }

  function writeSaves(saves) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    } catch (e) { /* ignore storage errors */ }
  }

  function persist() {
    if (!state || !state.gamertag) return;
    var saves = loadSaves();
    saves[state.gamertag] = { nodeId: state.nodeId, flags: state.flags };
    writeSaves(saves);
  }

  function freshState(gamertag) {
    return { gamertag: gamertag, nodeId: "prologue", flags: {} };
  }

  function renderSaveList() {
    var saves = loadSaves();
    var names = Object.keys(saves);
    if (!els.saveList) return;
    els.saveList.innerHTML = "";
    if (!names.length) return;
    var p = document.createElement("p");
    p.className = "gq-continue-label";
    p.textContent = "Continue a story already in progress:";
    els.saveList.appendChild(p);
    var list = document.createElement("ul");
    list.className = "gq-continue-list";
    names.forEach(function (name) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#";
      a.textContent = name;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        beginGame(name, saves[name]);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    els.saveList.appendChild(list);
  }

  function beginGame(gamertag, existing) {
    state = existing ? { gamertag: gamertag, nodeId: existing.nodeId || "prologue", flags: existing.flags || {} } : freshState(gamertag);
    els.titleScreen.hidden = true;
    els.game.hidden = false;
    els.gamertagLabel.textContent = gamertag;
    renderNode(state.nodeId);
  }

  function restart() {
    if (!state) return;
    var name = state.gamertag;
    state = freshState(name);
    persist();
    renderNode(state.nodeId);
  }

  function switchAdventurer() {
    state = null;
    els.game.hidden = true;
    els.titleScreen.hidden = false;
    renderSaveList();
  }

  function renderNode(id) {
    var resolved = resolveEnding(id, state);
    var node = STORY[resolved];
    if (!node) {
      node = { title: "The Road Ends Here", text: "This page does not exist, which is its own kind of ending.", choices: [] };
    }
    state.nodeId = resolved;

    if (node.setFlag) state.flags[node.setFlag] = true;
    maybeGrantClanTrust(state);
    persist();

    els.title.textContent = node.title;
    els.text.textContent = node.dynamicText ? node.dynamicText(state) : node.text;

    if (node.img) {
      els.img.src = IMG_BASE + node.img;
      els.img.alt = node.title;
      els.imgFrame.hidden = false;
    } else {
      els.imgFrame.hidden = true;
    }

    if (node.ending) {
      els.endingBanner.hidden = false;
      els.endingBanner.textContent = node.ending === "win" ? "The End (a good one)" : "The End";
      els.endingBanner.className = "gq-ending-banner gq-ending-" + node.ending;
    } else {
      els.endingBanner.hidden = true;
    }

    els.choices.innerHTML = "";
    var visible = (node.choices || []).filter(function (c) {
      return !c.requiresFlag || state.flags[c.requiresFlag];
    });

    if (!visible.length) {
      var again = document.createElement("a");
      again.href = "#";
      again.className = "gq-choice-link gq-restart-link";
      again.textContent = "Start the story over";
      again.addEventListener("click", function (evt) {
        evt.preventDefault();
        restart();
      });
      els.choices.appendChild(again);
      return;
    }

    var list = document.createElement("ul");
    list.className = "gq-choice-list";
    visible.forEach(function (choice) {
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#";
      a.className = "gq-choice-link";
      a.textContent = choice.label;
      a.addEventListener("click", function (evt) {
        evt.preventDefault();
        handleChoice(choice);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    els.choices.appendChild(list);
  }

  function handleChoice(choice) {
    if (choice.setFlag) state.flags[choice.setFlag] = true;
    if (choice.setFlags) choice.setFlags.forEach(function (f) { state.flags[f] = true; });
    if (choice.bumpFlag) state.flags[choice.bumpFlag] = (state.flags[choice.bumpFlag] || 0) + 1;
    renderNode(choice.next);
  }

  function init() {
    els.titleScreen = qs("#gq-title-screen");
    els.game = qs("#gq-game");
    els.saveList = qs("#gq-save-list");
    els.newForm = qs("#gq-new-form");
    els.newName = qs("#gq-new-name");
    els.gamertagLabel = qs("#gq-gamertag-label");
    els.switchBtn = qs("#gq-switch");
    els.imgFrame = qs("#gq-scene-frame");
    els.img = qs("#gq-scene-img");
    els.title = qs("#gq-scene-title");
    els.text = qs("#gq-scene-text");
    els.endingBanner = qs("#gq-ending-banner");
    els.choices = qs("#gq-choices");

    renderSaveList();

    els.newForm.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var name = (els.newName.value || "").trim();
      if (!name) return;
      var saves = loadSaves();
      beginGame(name, saves[name]);
      els.newName.value = "";
    });

    els.switchBtn.addEventListener("click", function () {
      switchAdventurer();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed only for the automated test harness; not used by the page.
  window.__GQ_TEST_API__ = {
    STORY: STORY,
    resolveEnding: resolveEnding,
    itemCount: itemCount,
    getState: function () { return state; },
    renderNode: function (id) { renderNode(id); },
    beginGame: beginGame,
    handleChoice: handleChoice
  };
})();
