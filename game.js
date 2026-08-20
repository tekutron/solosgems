// The Road to Solos Gems: a choose-your-own-adventure with dice checks, a
// real-time flap-and-dodge arcade minigame reused across several encounters,
// two classic timed minigames, an inventory of real reviewed tools
// reimagined as fantasy items you can prime and spend whenever you want, a
// final boss, and gamertag-based save slots stored in localStorage. No
// backend account system, no server state, everything lives in the
// visitor's own browser.

(function () {
  "use strict";

  var SAVE_KEY = "solosgems_quest_saves_v1";
  var IMG_BASE = "images/game/";

  // ---------------- Items ----------------
  // Each item is a real, currently-reviewed Solos Gems tool reframed as a
  // fantasy artifact, tied to a bonus on the checks and minigames that match
  // what the real tool actually does. NotebookLM is the one item that grants
  // a full automatic pass wherever it applies (it "only lights up for things
  // that are actually true"), everything else grants an advantage, a hint,
  // or extra time, never a full skip.
  var ITEMS = {
    notebooklm: {
      name: "NotebookLM Lantern",
      icon: "🔦",
      desc: "Only lights up for things that are actually true. Automatic success on any check or trial that involves spotting a lie, no roll or minigame needed.",
      link: "reviews/notebooklm.html"
    },
    grammarly: {
      name: "Grammarly's Owl",
      icon: "🦉",
      desc: "Reads every word of the fine print for you, twice. Advantage on any check that involves reading something closely, and pre-highlights the answer in proofreading trials.",
      link: "reviews/grammarly.html"
    },
    wispr: {
      name: "Wispr Flow Boots",
      icon: "👢",
      desc: "Moves as fast as you can think. Advantage on any check that involves speed or stealth, and extra time on any trial that involves keeping up.",
      link: "reviews/wispr-flow.html"
    },
    descript: {
      name: "Descript Shears",
      icon: "✂️",
      desc: "Cuts the bad take right out of the timeline. Automatic success on checks about undoing a mistake, and an extra guess in any proofreading trial.",
      link: "reviews/descript.html"
    },
    canva: {
      name: "Canva Cloak of Many Templates",
      icon: "🎭",
      desc: "Instantly makes whatever you're doing look extremely professional, whether or not it is. Advantage on any check that involves talking or looking your way past someone.",
      link: "reviews/canva-magic-studio.html"
    },
    fireflies: {
      name: "Fireflies Familiar",
      icon: "🎙️",
      desc: "Perches on your shoulder and remembers every word so you don't have to. Automatic success on checks about recalling something you were told earlier.",
      link: "reviews/fireflies-ai.html"
    },
    reclaim: {
      name: "Reclaim's Warden Whistle",
      icon: "📯",
      desc: "One blast and it defends whatever block of time you were about to lose. Advantage on checks about protecting your own time, and buys extra seconds in any trial about keeping up.",
      link: "reviews/reclaim-ai.html"
    },
    tldv: {
      name: "tl;dv's Perched Owl",
      icon: "🎧",
      desc: "Sits quietly and records the whole conversation, no bot icon, no fuss. Hints at the important word in proofreading trials and helps you recall what was actually said.",
      link: "reviews/tldv.html"
    }
  };

  // Every item can also be used on demand: click it in your inventory to
  // prime it, then it fires automatically on whatever check or trial you
  // face next, no need to know in advance whether it would have applied.
  // The effect type determines what "using it" actually does, matching
  // what the real tool is good at, not what it costs.
  //   auto      - skips the roll/minigame outright, immediate success
  //   hint      - reveals the answer in a minigame, still requires the click
  //   advantage - reroll a dice check and take the better result
  //   time      - extra seconds on any timed trial
  //   retry     - an extra guess in trials that penalize wrong guesses
  var ITEM_EFFECT = {
    notebooklm: "auto",
    fireflies: "auto",
    grammarly: "hint",
    tldv: "hint",
    descript: "retry",
    canva: "advantage",
    wispr: "time",
    reclaim: "time"
  };

  var ITEM_USE_FLAVOR = {
    notebooklm: "You hold up the Lantern. It only lights up for the truth, and right now it will not stop glowing.",
    fireflies: "The Familiar chirps once and plays the moment back for you, word for word.",
    grammarly: "The Owl blinks and the fine print rearranges itself, briefly, into something readable.",
    tldv: "The Owl replays the exact clip you needed, no scrubbing required.",
    descript: "One clean cut, and the part where you almost got it wrong never happened.",
    canva: "You look extremely professional for exactly as long as this takes.",
    wispr: "You move at the speed you actually think.",
    reclaim: "The Whistle sounds once, and this moment, at least, is defended."
  };

  // ---------------- Minigame content pools ----------------
  var TYPING_PHRASES = [
    "no credit card required results not guaranteed",
    "unlimited seats seat limits may apply",
    "cancel any time terms and conditions apply",
    "free forever forever ends next tuesday"
  ];

  var PROOFREAD_SENTENCES = [
    { tokens: ["This", "tool", "is", "completely", "guaranteed", "to", "never", "ever", "fail", "you."], badIndex: 4 },
    { tokens: ["Cancel", "any", "time,", "no", "questions", "asked,", "results", "not", "typical."], badIndex: 8 },
    { tokens: ["Our", "pricing", "is", "totally", "transparent", "and", "will", "not", "change."], badIndex: 3 }
  ];

  // ---------------- Story graph ----------------
  // Each node: id, title, img (bundled SVG, always used as the base/fallback),
  // liveScene (optional key the server can turn into a one-off AI image),
  // text, optional grantItem (item auto-added on arrival), choices[].
  // A choice is either a plain nav ({label, next}) or a dice check
  // ({label, check:{dc, success, fail, itemAuto:[], itemAdvantage:[]}}).
  // grantItem on a CHOICE (not the node) means picking that specific option
  // is what earns the item. A node can instead be type:"minigame" with a
  // game key (typing / factcheck / proofread), a startLabel, and success/fail
  // node ids, resolved by the minigame engine instead of a choice list.

  var STORY = {
    start: {
      title: "The Road to Solos Gems",
      img: "game-start.svg",
      text: "Word around the tavern is that somewhere past the hills sits Solos Gems, a shop where every tool on the shelf actually does what the sign says. You have heard this story before and it usually ends with someone crying into a 14 day free trial. You are going anyway, snacks in bag, expectations low.",
      choices: [
        { label: "Take the Subscription Road (long, but well traveled)", next: "road" },
        { label: "Cut through the Hype Forest (a shortcut, allegedly)", next: "forest" },
        { label: "Ask around the tavern first", next: "tavern" }
      ]
    },
    tavern: {
      title: "The Tavern",
      img: "game-tavern.svg",
      text: "A bard, three mercenaries, and a guy who insists his cousin basically built the place all have directions. None of them agree. In the corner, a hooded cartographer has not said a word and is quietly selling actual maps.",
      choices: [
        { label: "Follow the loudest guy, he seems confident", next: "scam" },
        { label: "Buy whatever the quiet cartographer is selling", next: "cartographer" },
        { label: "Check out the market stalls set up outside", next: "market" },
        { label: "Ask if anyone remembers a tool that didn't make it", next: "tavern_lore" },
        { label: "Ignore all of them and just start walking", next: "road" }
      ]
    },
    tavern_lore: {
      title: "The Old Stories",
      img: "game-tavern.svg",
      text: "An old patron in the corner does not look up from his drink. 'Oh, you want the ones that didn't make it,' he says. 'There was an oracle who ran up four billion in debt chasing a cure and folded seven years in, right after winning a game show, of all things. And an amulet the smiths just quietly stopped making one day, no explanation, no warning, gone by the end of the season. You start to notice a shape to it after a while. The confident ones go first.'",
      choices: [
        { label: "Buy him a drink for the story", next: "tavern", setFlag: "heardWarning" },
        { label: "Head back into the tavern", next: "tavern" }
      ]
    },
    market: {
      title: "The Bazaar of Extremely Legitimate Tools",
      img: "game-market.svg",
      text: "Just outside the tavern, a row of stalls has sprung up overnight, the way stalls do. Every vendor waves you over with the specific energy of someone who wants you to know their thing is not a scam, unlike that other guy's thing. Three stalls catch your eye. So does the exit.",
      choices: [
        { label: "Visit the Auctioneer's stall", next: "market_auction" },
        { label: "Visit the Cloak Merchant", next: "market_cloak" },
        { label: "Visit the Shear Sharpener", next: "market_shears" },
        { label: "Visit the Bootmaker", next: "market_boots" },
        { label: "Seen enough, keep moving", next: "road" }
      ]
    },
    market_boots: {
      title: "The Bootmaker",
      img: "game-market.svg",
      text: "A small stall with no sign, just a single pair of boots on a stand. 'Wispr Flow Boots,' the bootmaker says, not looking up from her work. 'You think it, they move. Handy for outrunning trolls, or just typing at the speed you actually talk.'",
      choices: [
        { label: "Try them on", next: "market", grantItem: "wispr" },
        { label: "Keep walking", next: "market" }
      ]
    },
    market_cloak: {
      title: "The Cloak Merchant",
      img: "game-market.svg",
      text: "A merchant drapes something over your shoulders before you can object. 'Canva Cloak of Many Templates,' she says. 'Instantly makes whatever you're doing look extremely professional, whether or not it is.' You have to admit, you look great.",
      choices: [
        { label: "Keep the cloak on", next: "market", grantItem: "canva" },
        { label: "Hand it back", next: "market" }
      ]
    },
    market_shears: {
      title: "The Shear Sharpener",
      img: "game-market.svg",
      text: "A quiet vendor offers you a small pair of gleaming shears. 'Descript Shears,' he says. 'Cut out the part where you said something dumb. Works on conversations, presentations, and, allegedly, regret.'",
      choices: [
        { label: "Take the shears", next: "market", grantItem: "descript" },
        { label: "Leave them on the table", next: "market" }
      ]
    },
    market_auction: {
      title: "The Auctioneer",
      img: "game-market.svg",
      type: "minigame",
      game: "typing",
      startLabel: "Try to keep up",
      text: "The auctioneer speed-talks a pitch so fast it loops back around to sounding calm. She dares you to repeat it back before she moves on to the next lot. You get the feeling you only have one real shot at this.",
      bonusTimeItems: ["wispr", "reclaim"],
      bonusTimeSeconds: 6,
      success: "market_auction_win",
      fail: "market_auction_lose"
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
    cartographer: {
      title: "The Cartographer",
      img: "game-cartographer.svg",
      text: "She does not say much. Instead of a map she slides across a small glass lantern. 'Point it at anything that claims to be smarter than it looks,' she says. 'It only lights up for things that are actually true.' You recognize the make. Everyone calls it a NotebookLM Lantern.",
      choices: [
        { label: "Thank her and head for the road", next: "road", grantItem: "notebooklm" }
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
    road: {
      title: "The Subscription Road",
      img: "game-road.svg",
      text: "A long, well paved road lined with tiny tollbooths every few hundred feet. At the biggest one stands a troll wearing a name tag that says Rex, Billing Department. He wants payment to let you pass, and he has already added a processing fee.",
      choices: [
        { label: "Pay whatever he asks", next: "crossroads", liveNext: "crossroads" },
        {
          label: "Negotiate him down to an annual rate",
          check: { statLabel: "Persuasion", dc: 11, success: "crossroads", fail: "toll_trap", itemAdvantage: ["canva"] }
        },
        {
          label: "Try to sneak past while he is distracted",
          check: { statLabel: "Stealth", dc: 12, success: "crossroads", fail: "toll_trap", itemAdvantage: ["wispr"] }
        }
      ]
    },
    toll_trap: {
      title: "The Auto-Renew Cage",
      img: "game-tolltrap.svg",
      text: "Rex smiles the smile of a man who has read the fine print you have not. A cage made entirely of auto-renew clauses drops over you. 'Don't worry,' he says, 'you can cancel any time. The button is just very, very small.'",
      choices: [
        {
          label: "Struggle out of the cage the hard way",
          check: { statLabel: "Strength", dc: 13, success: "crossroads", fail: "end_gaveup", itemAuto: ["descript"] }
        }
      ]
    },
    forest: {
      title: "The Hype Forest",
      img: "game-forest.svg",
      liveScene: "forest",
      text: "Every tree here is on fire with excitement and none of them are actually burning. Floating lanterns labeled REVOLUTIONARY and GAME-CHANGING drift between the branches, humming softly. It is beautiful. You have no idea where you are going.",
      choices: [
        { label: "Follow the brightest lantern deeper in", next: "wisp_chase" },
        {
          label: "Climb a tree and get your bearings first",
          check: { statLabel: "Perception", dc: 12, success: "crossroads", fail: "swamp", itemAuto: ["notebooklm"] }
        },
        { label: "Follow a strange hum coming from a side cave", next: "oracle_intro" },
        { label: "Investigate a soft, steady hum from a low branch", next: "owl_nest" },
        { label: "Turn back to the road", next: "road" }
      ]
    },
    wisp_chase: {
      title: "The Brightest Lantern",
      img: "game-forest.svg",
      type: "minigame",
      game: "arcade",
      startLabel: "Chase it",
      text: "The brightest lantern turns out to be attached to a small, fast, extremely pleased-with-itself wisp, and it takes off the second you reach for it, weaving between the other floating banners like it has done this a hundred times.",
      instructions: "Tap, click, or press space to flap. Fly through the gap in each cluster of banners.",
      playerEmoji: "🏃",
      obstacleEmoji: "🏮",
      arcadeBgClass: "gq-arcade-forest",
      flavorLabels: ["REVOLUTIONARY", "GAME-CHANGING", "PARADIGM SHIFT", "10X YOUR WORKFLOW", "BLEEDING EDGE", "DISRUPTIVE"],
      targetPasses: 4,
      winText: "You catch up right as it slows to loop back around. Up close it looks a little tired of its own hype, honestly relieved someone finally kept pace.",
      crashText: "You clip a banner reading PARADIGM SHIFT and go down in a heap of floating adjectives.",
      setFlagOnSuccess: "wispFriend",
      success: "wisp_chase_win",
      fail: "wisp_chase_lose"
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
      type: "minigame",
      game: "arcade",
      startLabel: "Listen in",
      text: "A small owl sits perfectly still on a low branch, one glass eye blinking steadily, clearly recording every word of a meeting happening somewhere just out of sight. It launches after you the moment you get close, weaving between drifting speech bubbles of pure noise. Stay in the air and it lets you pass.",
      instructions: "Tap, click, or press space to flap. Fly through the gap in each cluster of chatter.",
      playerEmoji: "🪶",
      obstacleEmoji: "💬",
      arcadeBgClass: "gq-arcade-forest",
      flavorLabels: ["can everyone see my screen", "sorry my dog is barking", "quick housekeeping first", "no you're not on mute", "let's circle back on that", "great, thanks everyone"],
      targetPasses: 5,
      winText: "You slip through the last cluster of noise clean. The owl blinks once, slowly, which you choose to take as approval.",
      crashText: "You fly straight into a wall of small talk. The owl does not judge you, exactly, it just keeps recording, unbothered.",
      grantItemOnSuccess: "tldv",
      success: "owl_win",
      fail: "owl_fail"
    },
    owl_win: {
      title: "The Owl Blinks Once",
      img: "game-owlnest.svg",
      text: "You catch the one line that mattered. The owl blinks once, slowly, which you choose to take as approval, and hops onto your shoulder, still recording out of habit.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    owl_fail: {
      title: "Lost in the Noise",
      img: "game-owlnest.svg",
      text: "You guess wrong. The owl does not judge you, exactly, it just keeps recording, unbothered, the way it will keep recording long after this meeting and every meeting after it.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    oracle_intro: {
      title: "The Cave of Reasonable Doubt",
      img: "game-oracle.svg",
      type: "minigame",
      game: "arcade",
      startLabel: "Step inside",
      text: "A low hum leads you off the forest path to a small cave where something large, feathered, and stitched together out of old citations is blocking the way. It does not ask you a riddle. It simply takes off, and the cave fills with drifting footnotes you will need to fly straight through.",
      instructions: "Tap, click, or press space to flap. Fly through the gap in each row of citations.",
      playerEmoji: "🕯️",
      obstacleEmoji: "📜",
      arcadeBgClass: "gq-arcade-cave",
      flavorLabels: ["citation needed", "peer review pending", "results not typical", "source: trust me", "footnote 47 of 200", "allegedly, according to a guy"],
      targetPasses: 5,
      winText: "You clear the last row of footnotes. The griffin makes a sound that might be a screech or might be applause, hard to tell with citations involved.",
      crashText: "You fly straight into a wall of unverified claims. The griffin sighs, the specific sigh of something that has cited its sources and still watched you crash into them.",
      autoSuccessItems: ["notebooklm"],
      grantItemOnSuccess: "fireflies",
      success: "oracle_win",
      fail: "oracle_fail"
    },
    oracle_win: {
      title: "The Griffin Approves",
      img: "game-oracle.svg",
      text: "The griffin makes a sound that might be a screech or might be applause, hard to tell with citations involved. It nods toward a small glowing creature perched nearby. 'Take the familiar,' it says. 'It remembers everything so you don't have to.' The Fireflies Familiar settles happily on your shoulder.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    oracle_fail: {
      title: "The Griffin Is Unimpressed",
      img: "game-oracle.svg",
      text: "You guess wrong. The griffin sighs, the specific sigh of something that has cited its sources and still lost the argument, and steps aside anyway. It seems more tired than angry.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    swamp: {
      title: "The Feature Bloat Swamp",
      img: "game-swamp.svg",
      text: "The ground here is not mud, it is settled sediment of a thousand unused features nobody asked for. Something small and glowing bobs up beside you, calling itself a Roadmap Wisp. 'You look stuck,' it says warmly. 'Want me to add a few more things to help?'",
      choices: [
        { label: "Sure, more features can only help", next: "end_swamp" },
        {
          label: "No thanks, wade out on your own",
          check: { statLabel: "Willpower", dc: 12, success: "crossroads", fail: "end_swamp", itemAdvantage: ["wispr", "reclaim"] }
        },
        { label: "Ask if there is a simpler wisp who just removes things", next: "crossroads" },
        {
          label: "Ask if it remembers you from the forest",
          requiresFlag: "wispFriend",
          next: "crossroads",
          grantItem: "reclaim"
        }
      ]
    },
    crossroads: {
      title: "The Shrine at the Crossroads",
      img: "game-crossroads.svg",
      liveScene: "crossroads",
      text: "Three roads diverge at a mossy shrine shaped suspiciously like a five star rating. A carved sign reads: MOUNTAIN PASS, a legendary automaton lives there, allegedly. RIVER FERRY, the ferryman wants payment, form unclear. TUNNEL, dark, quiet, no marketing whatsoever.",
      choices: [
        { label: "Take the Mountain Pass", next: "natasha" },
        { label: "Take the River Ferry", next: "ferryman" },
        { label: "Take the Tunnel", next: "tunnel" },
        { label: "Take the Overbooked Bridge", next: "bridge_warden" }
      ]
    },
    bridge_warden: {
      title: "The Overbooked Bridge",
      img: "game-bridge.svg",
      type: "minigame",
      game: "arcade",
      startLabel: "Approach the warden",
      text: "A narrow rope bridge sways over a gorge stacked floor to ceiling with floating calendar blocks, all of them trying to bump into each other for the same slot. The warden does not offer to let you through. She just steps aside and watches to see if you can actually hold your line.",
      instructions: "Tap, click, or press space to flap. Fly through the gap between each stack of meetings.",
      playerEmoji: "🕰️",
      obstacleEmoji: "📅",
      arcadeBgClass: "gq-arcade-bridge",
      flavorLabels: ["quick sync to align", "standup, again", "can this be an email", "quick five minute favor", "sync to align on the sync", "one more standup, somehow"],
      targetPasses: 6,
      winText: "You hold your line through the last stack without losing your slot once. The warden almost smiles and presses a small brass whistle into your hand.",
      crashText: "You get bumped clean off your line. The warden shakes her head, unsurprised. Everything looks protected until something louder shows up.",
      success: "bridge_win",
      fail: "bridge_fail"
    },
    bridge_win: {
      title: "The Warden Nods",
      img: "game-bridge.svg",
      text: "You point to the one slot that never moves. The warden almost smiles, snaps the ledger shut, and steps aside. 'Rare to see someone actually protect a block of time,' she says, and presses a small brass whistle into your hand.",
      grantItemOnSuccess: "reclaim",
      choices: [{ label: "Cross the bridge", next: "gate" }]
    },
    bridge_fail: {
      title: "Denied at the Bridge",
      img: "game-bridge.svg",
      text: "You guess wrong. The warden shakes her head, unsurprised. 'Everything looks protected until something louder shows up,' she says, and points you back the way you came.",
      choices: [{ label: "Try another route", next: "crossroads" }]
    },
    natasha: {
      title: "Natasha",
      img: "game-natasha.svg",
      text: "The mountain pass ends at a workshop lit by a hundred small screens. In the center stands Natasha, easily the most impressive automaton you have ever seen, gleaming, articulate, unmistakably a marvel of AI. 'Sign here,' she says, sliding over a contract roughly the length of the mountain range behind her, 'and you may pass. Forever. Technically.'",
      choices: [
        { label: "Sign without reading it", next: "end_natasha" },
        {
          label: "Actually read the contract first",
          check: {
            statLabel: "Intelligence",
            dc: 13,
            success: "gate",
            fail: "end_natasha",
            itemAuto: ["notebooklm"],
            itemAdvantage: ["grammarly"]
          }
        },
        {
          label: "Mention you've heard what happened to the last oracle who ran up four billion in debt",
          requiresFlag: "heardWarning",
          check: {
            statLabel: "Insight",
            dc: 10,
            success: "gate",
            fail: "ferryman",
            itemAdvantage: ["grammarly", "notebooklm"]
          }
        },
        { label: "Decline and back away slowly", next: "ferryman" }
      ]
    },
    ferryman: {
      title: "The Data Ferryman",
      img: "game-ferryman.svg",
      text: "A cloaked figure poles a small boat across a river that reflects things you never told anyone. 'Fare is simple,' he says. 'Your full name, your browsing history, and your mother's maiden name. For reasons.'",
      choices: [
        { label: "Pay in full, whatever gets you across", next: "gate" },
        {
          label: "Hand over a burner name and hope he does not check",
          check: { statLabel: "Deception", dc: 12, success: "gate", fail: "natasha", itemAdvantage: ["wispr"] }
        },
        { label: "Turn back toward the crossroads", next: "crossroads" }
      ]
    },
    tunnel: {
      title: "The Quiet Tunnel",
      img: "game-tunnel.svg",
      text: "No banners, no lanterns, no wisp trying to upsell you on anything. Just carved stone walls lined with small, honest notes. Good for solo work. Bad if you need a team plan. That sort of thing. It is suspiciously pleasant down here.",
      choices: [
        { label: "Hurry through without stopping to read", next: "gate" },
        { label: "Stop and actually read the carvings", next: "gate", grantItem: "grammarly" },
        {
          label: "Try to recall exactly what the cartographer told you about the lantern",
          check: { statLabel: "Memory", dc: 11, success: "gate", fail: "gate", itemAuto: ["fireflies"], itemAdvantage: ["tldv"], setFlagOnSuccess: "recallHint" }
        }
      ]
    },
    gate: {
      title: "The Gate of Solos Gems",
      img: "game-gate.svg",
      text: "A golem shaped like a cut gem blocks the final gate. It does not ask for payment. It asks a question instead. 'What matters more to you? What is popular this week, or what is actually good?'",
      choices: [
        { label: "What is actually good. Show me the honest list.", next: "golem_glitch" },
        {
          label: "Uh. Whatever is trending, probably?",
          check: {
            statLabel: "Wisdom",
            dc: 13,
            success: "golem_glitch",
            fail: "crossroads",
            itemAdvantage: ["grammarly", "notebooklm", "canva"]
          }
        },
        { label: "Try to bribe the golem with a coin purse", next: "crossroads" }
      ]
    },
    golem_glitch: {
      title: "The Golem Glitches",
      img: "game-golemglitch.svg",
      type: "minigame",
      game: "proofread",
      startLabel: "Listen closely",
      text: "The golem's chest panel sparks. For exactly one second it recites a pitch in a voice you have definitely heard earlier today. It sounds exactly like Natasha. The golem clears its throat, or the stone equivalent, and launches into a full monologue anyway, clearly proud of it. Somewhere in there is the one word doing all the heavy lifting. Click it before the golem wraps up.",
      hintItems: ["grammarly", "tldv"],
      extraAttemptsItems: ["descript"],
      extraAttempts: 1,
      success: "end_win",
      fail: "end_golem_glitch"
    },

    end_win: {
      title: "You Found Solos Gems",
      img: "game-end-win.svg",
      liveScene: "win",
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
    }
  };

  // ---------------- Dice ----------------
  function rollDie() {
    return 1 + Math.floor(Math.random() * 20);
  }

  // Returns a NEW check object with extra itemAuto/itemAdvantage ids merged
  // in, never mutating the shared STORY node's original check object.
  function mergeCheck(check, extra) {
    var out = {};
    for (var k in check) { if (check.hasOwnProperty(k)) out[k] = check[k]; }
    if (extra.itemAuto) out.itemAuto = (check.itemAuto || []).concat(extra.itemAuto);
    if (extra.itemAdvantage) out.itemAdvantage = (check.itemAdvantage || []).concat(extra.itemAdvantage);
    return out;
  }

  function resolveCheck(check, inventory) {
    var hasAuto = (check.itemAuto || []).some(function (id) { return inventory.indexOf(id) !== -1; });
    if (hasAuto) {
      return { auto: true, roll: null, success: true };
    }
    var advantage = (check.itemAdvantage || []).some(function (id) { return inventory.indexOf(id) !== -1; });
    var r1 = rollDie();
    var r2 = advantage ? rollDie() : null;
    var roll = advantage ? Math.max(r1, r2) : r1;
    var success;
    if (roll === 1) success = false;
    else if (roll === 20) success = true;
    else success = roll >= check.dc;
    return { auto: false, roll: roll, roll2: r2, advantage: advantage, success: success };
  }

  // ---------------- Minigame helpers ----------------
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function hasAny(ids) {
    if (!ids) return false;
    return ids.some(function (id) { return state.inventory.indexOf(id) !== -1; });
  }

  function normalize(str) {
    return String(str).toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }

  // ---------------- Save system ----------------
  function loadSaves() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeSaves(saves) {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
    } catch (e) {
      /* storage unavailable, game still works, just won't persist */
    }
  }

  function upsertSave(save) {
    var saves = loadSaves();
    var idx = saves.findIndex(function (s) { return s.gamertag === save.gamertag; });
    save.updatedAt = Date.now();
    if (idx === -1) {
      saves.push(save);
    } else {
      saves[idx] = save;
    }
    writeSaves(saves);
  }

  function deleteSave(gamertag) {
    var saves = loadSaves().filter(function (s) { return s.gamertag !== gamertag; });
    writeSaves(saves);
  }

  // ---------------- Engine ----------------
  var state = {
    gamertag: null,
    nodeId: "start",
    inventory: [],
    flags: {},
    primedItem: null
  };

  var els = {};
  var miniGameTimer = null;
  var miniGameCleanup = null;

  function qs(sel) { return document.querySelector(sel); }

  function init() {
    els.titleScreen = qs("#gq-title-screen");
    els.saveList = qs("#gq-save-list");
    els.newForm = qs("#gq-new-form");
    els.newInput = qs("#gq-new-name");
    els.game = qs("#gq-game");
    els.gamertagLabel = qs("#gq-gamertag-label");
    els.inventoryBar = qs("#gq-inventory");
    els.sceneFrame = qs(".gq-scene-frame");
    els.sceneImg = qs("#gq-scene-img");
    els.sceneTitle = qs("#gq-scene-title");
    els.sceneText = qs("#gq-scene-text");
    els.winBanner = qs("#gq-win-banner");
    els.choices = qs("#gq-choices");
    els.diceArea = qs("#gq-dice-area");
    els.diceSvg = qs("#gq-dice-svg");
    els.diceResult = qs("#gq-dice-result");
    els.minigameArea = qs("#gq-minigame-area");
    els.switchBtn = qs("#gq-switch");
    els.restartBtn = qs("#gq-restart");

    renderTitleScreen();

    els.newForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = (els.newInput.value || "").trim().slice(0, 24);
      if (!name) return;
      startNewGame(name);
    });

    els.switchBtn.addEventListener("click", function () {
      resetMiniGameArea();
      els.game.hidden = true;
      els.titleScreen.hidden = false;
      renderTitleScreen();
    });

    els.restartBtn.addEventListener("click", function () {
      if (!state.gamertag) return;
      startNewGame(state.gamertag);
    });
  }

  function renderTitleScreen() {
    var saves = loadSaves().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
    els.saveList.innerHTML = "";
    if (saves.length === 0) {
      var p = document.createElement("p");
      p.className = "gq-empty";
      p.textContent = "No adventurers yet. Name one below to begin.";
      els.saveList.appendChild(p);
      return;
    }
    saves.forEach(function (save) {
      var row = document.createElement("div");
      row.className = "gq-save-row";

      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gq-save-btn";
      var node = STORY[save.nodeId];
      var where = node ? node.title : "Unknown";
      var invCount = (save.inventory || []).length;
      btn.innerHTML =
        "<strong>" + escapeHtml(save.gamertag) + "</strong>" +
        "<span>" + escapeHtml(where) + " &middot; " + invCount + " item" + (invCount === 1 ? "" : "s") + "</span>";
      btn.addEventListener("click", function () { resumeGame(save); });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "gq-save-del";
      del.setAttribute("aria-label", "Delete save");
      del.textContent = "×";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        deleteSave(save.gamertag);
        renderTitleScreen();
      });

      row.appendChild(btn);
      row.appendChild(del);
      els.saveList.appendChild(row);
    });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function startNewGame(gamertag) {
    state.gamertag = gamertag;
    state.nodeId = "start";
    state.inventory = [];
    state.flags = {};
    upsertSave({ gamertag: gamertag, nodeId: state.nodeId, inventory: state.inventory, flags: state.flags, createdAt: Date.now() });
    enterGame();
  }

  function resumeGame(save) {
    state.gamertag = save.gamertag;
    state.nodeId = save.nodeId && STORY[save.nodeId] ? save.nodeId : "start";
    state.inventory = save.inventory || [];
    state.flags = save.flags || {};
    enterGame();
  }

  function enterGame() {
    els.titleScreen.hidden = true;
    els.game.hidden = false;
    els.gamertagLabel.textContent = state.gamertag;
    renderNode(state.nodeId);
  }

  function persist() {
    upsertSave({ gamertag: state.gamertag, nodeId: state.nodeId, inventory: state.inventory, flags: state.flags });
  }

  function renderInventory() {
    els.inventoryBar.innerHTML = "";
    if (state.inventory.length === 0) {
      var span = document.createElement("span");
      span.className = "gq-inv-empty";
      span.textContent = "Inventory: empty";
      els.inventoryBar.appendChild(span);
      return;
    }
    var label = document.createElement("span");
    label.className = "gq-inv-label";
    label.textContent = "Inventory (click to use):";
    els.inventoryBar.appendChild(label);
    state.inventory.forEach(function (id) {
      var item = ITEMS[id];
      if (!item) return;
      var chip = document.createElement("button");
      chip.type = "button";
      chip.className = "gq-item-chip";
      if (state.primedItem === id) chip.classList.add("gq-item-primed");
      chip.title = item.name + ": " + item.desc;
      chip.textContent = item.icon + " " + item.name;
      chip.addEventListener("click", function () { toggleItemPrime(id); });
      els.inventoryBar.appendChild(chip);
    });
    if (state.primedItem && ITEMS[state.primedItem]) {
      var status = document.createElement("span");
      status.className = "gq-inv-primed-note";
      status.textContent = "Ready: " + ITEMS[state.primedItem].icon + " " + ITEMS[state.primedItem].name + " will trigger on your next roll or trial.";
      els.inventoryBar.appendChild(status);
    }
  }

  function toggleItemPrime(id) {
    state.primedItem = state.primedItem === id ? null : id;
    renderInventory();
  }

  function consumePrimedItem() {
    var id = state.primedItem;
    if (!id) return null;
    state.primedItem = null;
    var idx = state.inventory.indexOf(id);
    if (idx !== -1) state.inventory.splice(idx, 1);
    return id;
  }

  function resetMiniGameArea() {
    if (miniGameTimer) {
      window.clearInterval(miniGameTimer);
      miniGameTimer = null;
    }
    if (miniGameCleanup) {
      miniGameCleanup();
      miniGameCleanup = null;
    }
    els.minigameArea.hidden = true;
    els.minigameArea.innerHTML = "";
  }

  function renderNode(nodeId) {
    var node = STORY[nodeId];
    if (!node) { nodeId = "start"; node = STORY.start; }
    state.nodeId = nodeId;
    persist();
    renderInventory();
    resetMiniGameArea();

    els.diceArea.hidden = true;
    els.sceneTitle.textContent = node.title;
    els.sceneText.textContent = node.text;
    els.sceneImg.src = IMG_BASE + node.img;
    els.sceneImg.alt = node.title + ", retro fantasy illustration";
    els.sceneImg.classList.remove("gq-loading");

    els.restartBtn.hidden = !node.ending;

    if (node.liveScene) {
      var fallback = IMG_BASE + node.img;
      var liveUrl = "/api/game-image?scene=" + encodeURIComponent(node.liveScene) + "&t=" + Date.now();
      var probe = new Image();
      els.sceneImg.classList.add("gq-loading");
      probe.onload = function () {
        if (state.nodeId === nodeId) {
          els.sceneImg.src = liveUrl;
          els.sceneImg.classList.remove("gq-loading");
        }
      };
      probe.onerror = function () {
        if (state.nodeId === nodeId) els.sceneImg.classList.remove("gq-loading");
      };
      probe.src = liveUrl;
      // fallback stays visible in els.sceneImg until/unless probe succeeds
      els.sceneImg.src = fallback;
    }

    els.choices.innerHTML = "";

    if (node.ending) {
      if (node.ending === "win") {
        els.sceneFrame.classList.add("gq-win-glow");
        els.winBanner.hidden = false;
        triggerWinFx();
        var cta = document.createElement("a");
        cta.href = "reviews.html";
        cta.className = "gq-cta";
        cta.textContent = "Browse the real, honest list →";
        els.choices.appendChild(cta);
      } else {
        els.sceneFrame.classList.remove("gq-win-glow");
        els.winBanner.hidden = true;
      }
      var again = document.createElement("button");
      again.type = "button";
      again.className = "gq-choice-btn gq-choice-again";
      again.textContent = "Play again";
      again.addEventListener("click", function () { startNewGame(state.gamertag); });
      els.choices.appendChild(again);
      return;
    }

    els.sceneFrame.classList.remove("gq-win-glow");
    els.winBanner.hidden = true;

    if (node.type === "minigame") {
      var startBtn = document.createElement("button");
      startBtn.type = "button";
      startBtn.className = "gq-choice-btn gq-choice-start";
      startBtn.textContent = node.startLabel || "Begin";
      startBtn.addEventListener("click", function () { startMiniGame(node); });
      els.choices.appendChild(startBtn);
      return;
    }

    node.choices.forEach(function (choice) {
      if (choice.requiresFlag && !state.flags[choice.requiresFlag]) return;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gq-choice-btn";
      btn.textContent = choice.label;
      btn.addEventListener("click", function () { handleChoice(choice); });
      els.choices.appendChild(btn);
    });
  }

  function handleChoice(choice) {
    if (choice.grantItem && state.inventory.indexOf(choice.grantItem) === -1) {
      state.inventory.push(choice.grantItem);
    }
    if (choice.setFlag) {
      state.flags[choice.setFlag] = true;
    }
    if (choice.check) {
      runDiceCheck(choice.check);
      return;
    }
    renderNode(choice.next);
  }

  function runDiceCheck(check) {
    var usedItem = null;
    var primedEffect = state.primedItem ? ITEM_EFFECT[state.primedItem] : null;
    if (primedEffect === "auto" || primedEffect === "hint") {
      usedItem = consumePrimedItem();
      check = mergeCheck(check, { itemAuto: [usedItem] });
    } else if (primedEffect) {
      usedItem = consumePrimedItem();
      check = mergeCheck(check, { itemAdvantage: [usedItem] });
    }
    var result = resolveCheck(check, usedItem ? state.inventory.concat([usedItem]) : state.inventory);
    els.choices.innerHTML = "";
    els.diceArea.hidden = false;
    els.diceResult.textContent = usedItem ? ITEM_USE_FLAVOR[usedItem] || "" : "";
    els.diceSvg.classList.remove("gq-dice-spin");
    void els.diceSvg.offsetWidth; // restart animation
    els.diceSvg.classList.add("gq-dice-spin");
    if (usedItem) renderInventory();

    window.setTimeout(function () {
      var text;
      if (result.auto) {
        text = check.statLabel + " check: " + (usedItem ? "used " + ITEMS[usedItem].name + "." : "your item makes this automatic.") + " Success.";
      } else if (result.advantage) {
        text = check.statLabel + " check (advantage): rolled " + result.roll + " and " + result.roll2 +
          ", using " + Math.max(result.roll, result.roll2) + " vs DC " + check.dc +
          ". " + (result.success ? "Success!" : "Failed.");
      } else {
        text = check.statLabel + " check: rolled " + result.roll + " vs DC " + check.dc +
          ". " + (result.success ? "Success!" : "Failed.");
      }
      els.diceResult.textContent = text;
      if (result.success && check.setFlagOnSuccess) {
        state.flags[check.setFlagOnSuccess] = true;
      }
      window.setTimeout(function () {
        renderNode(result.success ? check.success : check.fail);
      }, 1100);
    }, 750);
  }

  // ---------------- Minigames ----------------
  function finishMiniGame(node, success, resultText) {
    if (miniGameTimer) {
      window.clearInterval(miniGameTimer);
      miniGameTimer = null;
    }
    if (miniGameCleanup) {
      miniGameCleanup();
      miniGameCleanup = null;
    }
    els.minigameArea.innerHTML = '<p class="gq-mg-result">' + escapeHtml(resultText) + "</p>";
    if (success) {
      if (node.grantItemOnSuccess && state.inventory.indexOf(node.grantItemOnSuccess) === -1) {
        state.inventory.push(node.grantItemOnSuccess);
      }
      if (node.setFlagOnSuccess) {
        state.flags[node.setFlagOnSuccess] = true;
      }
    }
    window.setTimeout(function () {
      renderNode(success ? node.success : node.fail);
    }, 1300);
  }

  var miniGameBonus = null; // { itemId, effect } from a primed item, or null

  function startMiniGame(node) {
    els.choices.innerHTML = "";
    els.diceArea.hidden = true;
    els.minigameArea.hidden = false;
    els.minigameArea.innerHTML = "";
    miniGameBonus = null;

    if (node.autoSuccessItems && hasAny(node.autoSuccessItems)) {
      finishMiniGame(node, true, "Your item makes this automatic. The lantern lights up the truth before anyone finishes talking.");
      return;
    }

    var primedEffect = state.primedItem ? ITEM_EFFECT[state.primedItem] : null;
    if (primedEffect === "auto") {
      var usedId = consumePrimedItem();
      renderInventory();
      finishMiniGame(node, true, ITEM_USE_FLAVOR[usedId] || "Your item handles this one for you.");
      return;
    }
    if (primedEffect) {
      var boostId = consumePrimedItem();
      renderInventory();
      miniGameBonus = { itemId: boostId, effect: primedEffect };
      var flavor = document.createElement("p");
      flavor.className = "gq-mg-result";
      flavor.textContent = ITEM_USE_FLAVOR[boostId] || "";
      els.minigameArea.appendChild(flavor);
    }

    if (node.game === "typing") setupTyping(node);
    else if (node.game === "proofread") setupProofread(node);
    else if (node.game === "arcade") setupArcade(node);
  }

  function primedBonusSeconds() { return miniGameBonus ? 6 : 0; }

  function setupTyping(node) {
    var phrase = pick(TYPING_PHRASES);
    var timeLimit = 13 + (hasAny(node.bonusTimeItems) ? (node.bonusTimeSeconds || 0) : 0) + primedBonusSeconds();
    var remaining = timeLimit;

    var wrap = document.createElement("div");
    wrap.className = "gq-mg";

    var target = document.createElement("p");
    target.className = "gq-mg-target";
    target.textContent = '"' + phrase + '"';
    wrap.appendChild(target);

    var input = document.createElement("input");
    input.type = "text";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "Type it back, fast";
    wrap.appendChild(input);

    var timerEl = document.createElement("p");
    timerEl.className = "gq-mg-timer";
    wrap.appendChild(timerEl);

    els.minigameArea.appendChild(wrap);
    updateTimer();
    input.focus();

    input.addEventListener("input", function () {
      if (normalize(input.value) === normalize(phrase)) {
        finishMiniGame(node, true, "You repeated it back word for word. The auctioneer looks personally offended.");
      }
    });

    miniGameTimer = window.setInterval(function () {
      remaining -= 1;
      updateTimer();
      if (remaining <= 0) {
        finishMiniGame(node, false, "Time's up. The auctioneer moves on to the next lot before you finish the sentence.");
      }
    }, 1000);

    function updateTimer() { timerEl.textContent = Math.max(remaining, 0) + "s"; }
  }

  function setupProofread(node) {
    var sentence = pick(PROOFREAD_SENTENCES);
    var bonusEffect = miniGameBonus ? miniGameBonus.effect : null;
    var hint = hasAny(node.hintItems) || bonusEffect === "hint" || bonusEffect === "auto";
    var attemptsLeft = 2 + (hasAny(node.extraAttemptsItems) ? (node.extraAttempts || 1) : 0) + (bonusEffect === "retry" ? 1 : 0);
    var remaining = 14 + (state.flags.recallHint ? 3 : 0) + (bonusEffect === "time" || bonusEffect === "advantage" ? 6 : 0);

    var wrap = document.createElement("div");
    wrap.className = "gq-mg";

    var instructions = document.createElement("p");
    instructions.className = "gq-mg-instructions";
    instructions.textContent = "Click the word doing all the heavy lifting.";
    wrap.appendChild(instructions);

    var sentenceEl = document.createElement("p");
    sentenceEl.className = "gq-mg-sentence";
    sentence.tokens.forEach(function (word, i) {
      var span = document.createElement("span");
      span.className = "gq-mg-word";
      if (hint && i === sentence.badIndex) span.classList.add("gq-mg-glow");
      span.textContent = word;
      span.addEventListener("click", function () {
        if (span.classList.contains("gq-mg-wrong")) return;
        if (i === sentence.badIndex) {
          finishMiniGame(node, true, "Found it. The golem makes a sound like a dial-up modem giving up.");
        } else {
          attemptsLeft -= 1;
          span.classList.add("gq-mg-wrong");
          if (attemptsLeft <= 0) {
            finishMiniGame(node, false, "Out of guesses. The golem finishes its pitch, uninterrupted and deeply satisfied.");
          }
        }
      });
      sentenceEl.appendChild(span);
      sentenceEl.appendChild(document.createTextNode(" "));
    });
    wrap.appendChild(sentenceEl);

    var timerEl = document.createElement("p");
    timerEl.className = "gq-mg-timer";
    wrap.appendChild(timerEl);

    els.minigameArea.appendChild(wrap);
    updateTimer();

    miniGameTimer = window.setInterval(function () {
      remaining -= 1;
      updateTimer();
      if (remaining <= 0) {
        finishMiniGame(node, false, "Time's up. The golem wraps up its pitch and asks if you have questions. You do not.");
      }
    }, 1000);

    function updateTimer() { timerEl.textContent = Math.max(remaining, 0) + "s"; }
  }

  // ---------------- Arcade minigame (Flappy-Bird-style) ----------------
  // A single reusable real-time skill minigame: tap/click/space to flap
  // against constant gravity and thread the gaps in a stream of obstacles
  // moving toward you. Reskinned per node via playerEmoji/obstacleEmoji/
  // bg class and a couple of cosmetic floating flavor labels. Success is
  // about timing and nerve, not guessing which button is the "right" one.
  function setupArcade(node) {
    var wrap = document.createElement("div");
    wrap.className = "gq-mg";

    var instructions = document.createElement("p");
    instructions.className = "gq-mg-instructions";
    instructions.textContent = node.instructions || "Tap, click, or press space to flap. Thread the gaps.";
    wrap.appendChild(instructions);

    var lives = 2 + (miniGameBonus ? 1 : 0);
    var livesEl = document.createElement("p");
    livesEl.className = "gq-mg-timer";
    wrap.appendChild(livesEl);

    var stage = document.createElement("div");
    stage.className = "gq-arcade" + (node.arcadeBgClass ? " " + node.arcadeBgClass : "");
    wrap.appendChild(stage);

    els.minigameArea.appendChild(wrap);

    var player = document.createElement("div");
    player.className = "gq-arcade-player";
    player.textContent = node.playerEmoji || "🧙";
    stage.appendChild(player);

    var startOverlay = document.createElement("div");
    startOverlay.className = "gq-arcade-start";
    startOverlay.innerHTML = '<span class="gq-arcade-start-btn">▶ Tap or click to start</span>';
    stage.appendChild(startOverlay);

    function updateLives() { livesEl.textContent = "Lives: " + "❤️".repeat(Math.max(lives, 0)); }
    updateLives();

    var stageW, stageH;
    var playerY, vy;
    var GRAVITY = 0.22;
    var FLAP = -5.4;
    var PLAYER_X = 44;
    var PLAYER_R = 15;
    var SPEED = 2.6;
    var GAP = 108;
    var obstacles = [];
    var passed = 0;
    var targetPasses = node.targetPasses || 5;
    var frameHandle = null;
    var spawnHandle = null;
    var startTimeoutHandle = null;
    var running = true;
    var started = false;
    var flavorPool = (node.flavorLabels || []).slice();

    function nextFlavor() {
      if (flavorPool.length === 0) flavorPool = (node.flavorLabels || []).slice();
      var i = Math.floor(Math.random() * flavorPool.length);
      return flavorPool.splice(i, 1)[0] || "";
    }

    function measure() {
      stageW = stage.clientWidth;
      stageH = stage.clientHeight;
    }

    function spawnObstacle() {
      if (!running) return;
      var gapY = 30 + Math.random() * (stageH - GAP - 60);
      var el = document.createElement("div");
      el.className = "gq-arcade-obstacle";
      el.style.left = stageW + "px";
      var top = document.createElement("div");
      top.className = "gq-arcade-bar gq-arcade-bar-top";
      top.style.height = gapY + "px";
      var bottom = document.createElement("div");
      bottom.className = "gq-arcade-bar gq-arcade-bar-bottom";
      bottom.style.height = (stageH - gapY - GAP) + "px";
      var tag = document.createElement("span");
      tag.className = "gq-arcade-tag";
      tag.textContent = node.obstacleEmoji || "📄";
      top.appendChild(tag.cloneNode(true));
      if (node.flavorLabels && node.flavorLabels.length) {
        var label = document.createElement("span");
        label.className = "gq-arcade-label";
        label.textContent = nextFlavor();
        bottom.appendChild(label);
      }
      el.appendChild(top);
      el.appendChild(bottom);
      stage.appendChild(el);
      obstacles.push({ el: el, x: stageW, gapY: gapY, passed: false });
    }

    function crash(reason) {
      lives -= 1;
      updateLives();
      if (lives <= 0) {
        running = false;
        stopLoop();
        finishMiniGame(node, false, reason);
        return;
      }
      // brief invincible flash and knock the player back up, run continues
      player.classList.add("gq-arcade-hit");
      window.setTimeout(function () { player.classList.remove("gq-arcade-hit"); }, 260);
      vy = FLAP * 0.7;
    }

    function tick() {
      if (!running) return;
      vy += GRAVITY;
      playerY += vy;
      if (playerY < PLAYER_R) { playerY = PLAYER_R; vy = 0; }
      if (playerY > stageH - PLAYER_R) { crash("You dip out of frame entirely. That is, apparently, how you lose this one."); return; }
      player.style.top = playerY + "px";

      for (var i = obstacles.length - 1; i >= 0; i--) {
        var o = obstacles[i];
        o.x -= SPEED;
        o.el.style.left = o.x + "px";

        var playerLeft = PLAYER_X - PLAYER_R, playerRight = PLAYER_X + PLAYER_R;
        var obstacleLeft = o.x, obstacleRight = o.x + 34;
        var overlapsX = playerRight > obstacleLeft && playerLeft < obstacleRight;
        if (overlapsX) {
          var inGap = (playerY - PLAYER_R) > o.gapY && (playerY + PLAYER_R) < (o.gapY + GAP);
          if (!inGap) {
            stage.removeChild(o.el);
            obstacles.splice(i, 1);
            crash(node.crashText || "You clip the edge and go down.");
            return;
          }
        }
        if (!o.passed && o.x + 34 < PLAYER_X - PLAYER_R) {
          o.passed = true;
          passed += 1;
          if (passed >= targetPasses) {
            running = false;
            stopLoop();
            finishMiniGame(node, true, node.winText || "Clean run. You make it through without a scratch.");
            return;
          }
        }
        if (o.x < -40) {
          stage.removeChild(o.el);
          obstacles.splice(i, 1);
        }
      }

      frameHandle = window.requestAnimationFrame(tick);
    }

    function flap() {
      if (!running || !started) return;
      vy = FLAP;
    }

    function stopLoop() {
      if (frameHandle) window.cancelAnimationFrame(frameHandle);
      if (spawnHandle) window.clearInterval(spawnHandle);
      if (startTimeoutHandle) window.clearTimeout(startTimeoutHandle);
      frameHandle = null;
      spawnHandle = null;
      startTimeoutHandle = null;
    }

    // Rest the player at the vertical center while waiting for the player to
    // actually start, no gravity applies and nothing spawns until they do.
    window.requestAnimationFrame(function () {
      measure();
      playerY = stageH / 2;
      vy = 0;
      player.style.top = playerY + "px";
    });

    function beginPlay() {
      if (started) return;
      started = true;
      if (startOverlay.parentNode) startOverlay.parentNode.removeChild(startOverlay);
      measure();
      playerY = stageH / 2;
      vy = FLAP * 0.45; // small starting lift so play doesn't begin mid-freefall
      player.style.top = playerY + "px";
      spawnHandle = window.setInterval(spawnObstacle, 1350);
      startTimeoutHandle = window.setTimeout(spawnObstacle, 900); // grace period before the first obstacle arrives
      frameHandle = window.requestAnimationFrame(tick);
    }

    // Bind several input event types on both the stage and its wrapper so a
    // flap (or the initial start) registers regardless of pointer-event
    // support in the visitor's browser (older WebViews and some mobile
    // browsers only fire a subset).
    var lastFlapAt = 0;
    function onFlapInput(e) {
      var now = Date.now();
      if (now - lastFlapAt < 60) return; // de-dupe when multiple event types fire for one tap
      lastFlapAt = now;
      if (e.cancelable) e.preventDefault();
      if (!started) { beginPlay(); return; }
      flap();
    }
    ["pointerdown", "mousedown", "touchstart", "click"].forEach(function (evt) {
      stage.addEventListener(evt, onFlapInput, { passive: false });
      wrap.addEventListener(evt, onFlapInput, { passive: false });
    });
    var keyHandler = function (e) {
      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (!started) beginPlay(); else flap();
      }
    };
    document.addEventListener("keydown", keyHandler);

    miniGameCleanup = function () {
      document.removeEventListener("keydown", keyHandler);
      ["pointerdown", "mousedown", "touchstart", "click"].forEach(function (evt) {
        stage.removeEventListener(evt, onFlapInput);
        wrap.removeEventListener(evt, onFlapInput);
      });
      stopLoop();
    };
  }

  // ---------------- Win animation ----------------
  function triggerWinFx() {
    var fx = document.createElement("div");
    fx.className = "gq-winfx";
    var symbols = ["💎", "✨", "🎉", "💰"];
    for (var i = 0; i < 22; i++) {
      var piece = document.createElement("span");
      piece.className = "gq-winfx-piece";
      piece.textContent = symbols[i % symbols.length];
      piece.style.left = Math.random() * 96 + "%";
      piece.style.animationDelay = (Math.random() * 0.7).toFixed(2) + "s";
      piece.style.animationDuration = (1.8 + Math.random() * 1.4).toFixed(2) + "s";
      piece.style.fontSize = (14 + Math.random() * 16).toFixed(0) + "px";
      fx.appendChild(piece);
    }
    els.sceneFrame.appendChild(fx);
    window.setTimeout(function () {
      if (fx.parentNode) fx.parentNode.removeChild(fx);
    }, 3600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
