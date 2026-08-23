// The Road to Solos Gems: a page-and-link choose-your-own-adventure with a
// small, real ability system underneath. Eight AI-flavored abilities,
// point-buy character creation, no dice, no combat, no HUD noise beyond a
// slim route breadcrumb and an ability readout. Choices can be gated by an
// ability threshold the same way they can be gated by an item flag, and a
// hidden Alignment Drift counter tracks whether the player's actual
// choices matched whatever they claimed on the character sheet. Every
// ending closes with a generated "Exit Interview" summary of the run.

(function () {
  "use strict";

  var IMG_BASE = "images/game/";
  var SAVE_KEY = "gq_saves_v4";

  // ---------------------------------------------------------------------
  // Abilities
  // ---------------------------------------------------------------------

  var ABILITIES = [
    { id: "pe", label: "Prompt Engineering" },
    { id: "hr", label: "Hallucination Resistance" },
    { id: "cw", label: "Context Window" },
    { id: "ft", label: "Fine-Tuning" },
    { id: "ag", label: "Agency" },
    { id: "al", label: "Alignment" },
    { id: "re", label: "Retrieval" },
    { id: "mm", label: "Multimodality" }
  ];
  var ABILITY_LABELS = {};
  ABILITIES.forEach(function (a) { ABILITY_LABELS[a.id] = a.label; });
  var BASE_SCORE = 1;
  var BONUS_POINTS = 7;
  var MAX_SCORE = 4;

  function freshAbilities() {
    var out = {};
    ABILITIES.forEach(function (a) { out[a.id] = BASE_SCORE; });
    return out;
  }

  // ---------------------------------------------------------------------
  // The story graph. Every page is a title, some text (or a dynamicText
  // function), a caption under the picture, and a list of choices. A
  // choice can require a flag, an ability minimum, or an ability maximum
  // to appear (requiresFlag / requiresAbility / requiresAbilityMax), and
  // can set flags, bump a counter, nudge the Alignment Drift counter
  // (drift), or record a highlight moment for the end-of-run summary
  // (abilityHighlight) when clicked.
  // ---------------------------------------------------------------------

  var STORY = {
    charrecap: {
      title: "Before You Set Out",
      img: "game-start.svg",
      caption: "Every spec sheet is a promise nobody in the building has actually tested.",
      dynamicText: function (s) {
        var lines = ABILITIES.map(function (a) {
          return a.label + " " + s.abilities[a.id];
        });
        var role = computeRole(s);
        return "Your build is locked in: " + lines.join(", ") + ". Nobody gets to patch this later, same as it ever was. For the record, the system has already filed you under " + role + ", whether that turns out to be accurate is entirely up to what you do next, not what you just told it about yourself.";
      },
      choices: [{ label: "Continue to the road", next: "start" }]
    },
    start: {
      title: "The Road to Solos Gems",
      img: "game-start.svg",
      caption: "The road to enlightenment is paved with tools that were, and we cannot stress this enough, revolutionary.",
      dynamicText: function (s) {
        var top = topAbility(s);
        var lean = "";
        if (top === "pe") lean = "You have already rehearsed how this conversation is going to go, three different ways, out loud, alone. ";
        else if (top === "hr") lean = "You have already decided not to believe the first three people who talk to you today. Statistically, this is still not skeptical enough. ";
        else if (top === "cw") lean = "You are already keeping a mental list of everything anyone tells you today, on the theory that it will matter later. It usually does. ";
        else if (top === "ft") lean = "You packed exactly one tool you already know how to use extremely well, and nothing else, on principle. ";
        else if (top === "ag") lean = "You packed light, on the theory that you can always fix a problem once you are already standing in it, ideally live, in front of people who trusted you. ";
        else if (top === "al") lean = "You have already decided you would rather talk your way through today than fight your way through it, which on this road counts as a controversial opinion. ";
        else if (top === "re") lean = "You have already memorized three facts nobody asked for, on the theory that one of them will matter later. ";
        else if (top === "mm") lean = "You are already looking at ordinary objects and wondering what else they could plausibly be used for. This will not stop today. ";
        return lean + "Word around the tavern is that somewhere past the hills sits Solos Gems, a shop where every tool on the shelf actually does what the sign says. You have heard this story before and it always ends the same way, with somebody sobbing quietly into a free trial that renewed itself. You are going anyway, snacks in bag, expectations subterranean.";
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
      caption: "Confidence is just a rumor that has been repeated enough times to grow a personality.",
      dynamicText: function (s) {
        var extra = s.abilities.hr <= 1
          ? " You find yourself nodding along with the loudest guy anyway. He has a very trustworthy jawline. This is not, technically, a skill. It should be."
          : "";
        return "A bard, three mercenaries, and a guy who insists his cousin basically built the place all have directions. None of them agree, and all of them are extremely confident about it, which you have learned to treat as a warning sign rather than a credential. In the corner, a hooded cartographer has not said a word and is quietly selling actual maps." + extra;
      },
      choices: [
        { label: "Follow the loudest guy, he seems confident", next: "scam" },
        {
          label: "See through Grift's pitch before he even finishes it",
          requiresAbility: { id: "hr", min: 3 },
          next: "scam_seen_through",
          abilityHighlight: "hr"
        },
        { label: "Buy whatever the quiet cartographer is selling", next: "cartographer" },
        { label: "Check out the market stalls set up outside", next: "market" },
        { label: "Ask if anyone remembers a tool that didn't make it", next: "tavern_lore" },
        { label: "Follow the rumor about a path out back", next: "deathstack_gate", requiresFlag: "heardWarning" },
        { label: "Ignore all of them and just start walking", next: "road" }
      ]
    },
    scam_seen_through: {
      title: "You've Seen This One Before",
      img: "game-scam.svg",
      caption: "Pattern matching is, at minimum, ninety percent of wisdom.",
      text: "Grift McPromise is three words into his limited time offer when you finish the sentence for him, correctly, guaranteed results, terms subject to change, refund policy unclear. He stops mid-gesture, genuinely thrown, the way a script gets thrown by someone who has clearly read it before. 'Have we met,' he asks, and you do not dignify that with an answer, because you have met him roughly forty times, he has just never once been the one who remembered.",
      choices: [{ label: "Leave him to find a fresher audience", next: "road" }]
    },
    tavern_lore: {
      title: "The Old Stories",
      img: "game-tavern.svg",
      caption: "Nothing ages faster than a keynote about the future.",
      text: "An old patron in the corner does not look up from his drink. 'Oh, you want the ones that didn't make it,' he says. 'There was an oracle who ran up four billion in debt chasing a cure and folded seven years in, right after winning a game show, of all things, as if the universe wanted the joke told properly. And an amulet the smiths just quietly stopped making one day, no explanation, no warning, no farewell tour, gone by the end of the season like it had never had a launch party at all. You start to notice a shape to it after a while. The confident ones go first. There's a path out back, if you want to see for yourself.'",
      choices: [
        { label: "Buy him a drink for the story", next: "tavern", setFlag: "heardWarning" },
        { label: "Head back into the tavern", next: "tavern" }
      ]
    },
    deathstack_gate: {
      title: "The Overgrown Path",
      img: "game-graveyard.svg",
      caption: "A graveyard is just a changelog nobody reads anymore.",
      text: "The old patron's directions turn out to be real. A narrow trail behind the tavern, choked with weeds nobody bothered to enchant away, leads to a small clearing full of modest headstones, each one somehow already outdated by the time it was carved. Somebody has clearly been maintaining this place out of spite, or possibly out of the last remaining shred of institutional memory anyone on this road still has.",
      choices: [
        { label: "Read the headstones", next: "deathstack_plugins" },
        {
          label: "Cross-reference these headstones against everything else you've heard on this road",
          requiresAbility: { id: "re", min: 3 },
          next: "deathstack_extra",
          abilityHighlight: "re"
        },
        { label: "This feels like a waste of time, head back", next: "tavern" }
      ]
    },
    deathstack_extra: {
      title: "Here Lies: The One Nobody Mentions At Parties",
      img: "game-graveyard.svg",
      caption: "The best-documented failures are always the ones everyone quietly agreed to stop citing.",
      text: "You cross-reference the names on these stones against everything you have picked up so far and find a fourth grave, smaller, unlabeled, tucked behind the others where the moss grows thickest. It belonged to a note-taking amulet that was, by every available account, extremely good at its job, right up until the day its maker got a better offer and simply stopped answering the amulet's calls, so to speak. Nobody wrote a eulogy. You appear to be the first visitor in years, and only because you actually bothered to check.",
      choices: [{ label: "Add it to the list and move on", next: "deathstack_plugins" }]
    },
    deathstack_plugins: {
      title: "Here Lies: The Landlord's Plugins",
      img: "game-graveyard.svg",
      caption: "Every platform loves its ecosystem right up until the ecosystem becomes competition.",
      text: "The first headstone belongs to a small marketplace that briefly let you bolt anything onto anything, for a small fee, forever, allegedly. A translucent shopkeeper still haunts the plot, muttering about a rug pull. 'One day the landlord just added everything I sold into the base building. For free. Didn't even give me a saving throw, or so much as an apology email with a slightly too cheerful subject line,' he says, and fades a little more before your eyes, the way most business models do.",
      choices: [{ label: "Offer a moment of silence and move on", next: "deathstack_neeva" }]
    },
    deathstack_neeva: {
      title: "Here Lies: The Perfect Search Oracle",
      img: "game-graveyard.svg",
      caption: "The smartest team in the room still loses to the team that is simply free.",
      text: "The next grave belongs to a search oracle built by the very people who used to run search ads for the empire down the road, on the theory that the fox makes an excellent henhouse consultant. Its ghost still charges a toll, out of habit, for a road a free alternative runs right past without slowing down. 'We had the smartest party in the realm,' it sighs. 'Turns out free is also a strategy, and it plays dirty, and it does not care how smart you are.'",
      choices: [{ label: "Pay the phantom toll out of respect, then move on", next: "deathstack_humane" }]
    },
    deathstack_humane: {
      title: "Here Lies: The Talking Pin",
      img: "game-graveyard.svg",
      caption: "Nothing says future of computing quite like a product that needs its own charging dock.",
      text: "The last grave is small and shiny, and used to project a tiny glowing menu onto your palm whenever you spoke to it, whether you asked it to or not, which in retrospect was the whole problem. A single laser flickers weakly from the headstone, still trying to show you the weather nobody asked about. 'It was going to replace the scroll entirely,' someone nearby says. 'It did not replace the scroll. It replaced roughly one investor's judgment, briefly.' You leave the clearing a little wiser and mostly just tired, which is the most honest review anyone gives anything on this road.",
      choices: [{ label: "Head back to the tavern", next: "tavern", setFlag: "raidedGraveyard" }]
    },

    // -------- The Market --------
    market: {
      title: "The Bazaar of Extremely Legitimate Tools",
      img: "game-market.svg",
      caption: "Every stall here is one Series A away from calling itself a category.",
      text: "Just outside the tavern, a row of stalls has sprung up overnight, the way stalls do, fully formed and already claiming to be disrupting the stall industry. Every vendor waves you over with the specific energy of someone who wants you to know their thing is not a scam, unlike that other guy's thing, which is definitely a scam, everyone agrees, except the other guy, who says the same about this guy. Several stalls catch your eye. So does the exit.",
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
      caption: "Typing was never the bottleneck. Knowing what to say was.",
      text: "A small stall with no sign, just a single pair of boots on a stand. 'Wispr Flow Boots,' the bootmaker says, not looking up from her work. 'You think it, they move. Handy for outrunning trolls, or just typing at the speed you actually talk, which turns out to be a genuinely low bar most keyboards have failed to clear for forty years.'",
      choices: [
        { label: "Try them on", next: "market", setFlag: "hasWispr" },
        { label: "Keep walking", next: "market" }
      ]
    },
    market_cloak: {
      title: "The Cloak Merchant",
      img: "game-market.svg",
      caption: "Looking finished and being finished have never once been the same thing.",
      text: "A merchant drapes something over your shoulders before you can object, the sales pitch equivalent of a hostage situation. 'Canva Cloak of Many Templates,' she says. 'Instantly makes whatever you're doing look extremely professional, whether or not it is, which frankly describes most of this road.' You have to admit, you look great. You have no idea what you actually made.",
      choices: [
        { label: "Keep the cloak on", next: "market", setFlag: "hasCanva" },
        { label: "Hand it back", next: "market" }
      ]
    },
    market_shears: {
      title: "The Shear Sharpener",
      img: "game-market.svg",
      caption: "Editing yourself after the fact is still cheaper than thinking first.",
      text: "A quiet vendor offers you a small pair of gleaming shears. 'Descript Shears,' he says. 'Cut out the part where you said something dumb. Works on conversations, presentations, and, allegedly, regret, though nobody has actually gotten regret to render properly yet.'",
      choices: [
        { label: "Take the shears", next: "market", setFlag: "hasDescript" },
        { label: "Leave them on the table", next: "market" }
      ]
    },
    market_auction: {
      title: "The Auctioneer",
      img: "game-market.svg",
      caption: "Fast enough, and a sales pitch just sounds like the weather.",
      text: "The auctioneer speed-talks a pitch so fast it loops back around to sounding calm, the vocal equivalent of terms and conditions nobody reads because nobody could. She dares you to repeat it back before she moves on to the next lot, fully aware you will not.",
      choices: [
        { label: "Try to keep up and repeat it back", next: "market_auction_win" },
        { label: "Let this one go", next: "market_auction_lose" }
      ]
    },
    market_auction_win: {
      title: "Sold",
      img: "game-market.svg",
      caption: "Nothing insults a salesman quite like being understood.",
      text: "You get every word out just in time. The auctioneer looks personally offended that you kept up, and mutters something about seeing you at the next lot, already lining up a faster one out of professional spite.",
      choices: [{ label: "Back to the stalls", next: "market" }]
    },
    market_auction_lose: {
      title: "No Sale",
      img: "game-market.svg",
      caption: "Urgency is just a discount that expires the moment you look away.",
      text: "You get about half the sentence out before she is three lots ahead of you, unbothered, undefeated, and already pitching someone else the exact same urgency. She does not slow down for you specifically. Nobody ever does. That is, technically, the business model.",
      choices: [{ label: "Back to the stalls", next: "market" }]
    },
    market_compass: {
      title: "The Compass Stall",
      img: "game-market.svg",
      caption: "The most disruptive feature on this entire road turned out to be patience.",
      text: "A vendor with an unnervingly steady hand offers you a small brass compass. 'Claude's Compass,' she says. 'Points true north. Refuses to point toward anything it thinks you will regret. Slower than the other stalls. More likely to actually get you there, which on this road counts as a wildly aggressive feature.'",
      choices: [
        { label: "Take the compass", next: "market", setFlag: "hasCompass" },
        { label: "Keep walking", next: "market" }
      ]
    },
    market_relics: {
      title: "The Odds and Ends Stall",
      img: "game-market.svg",
      caption: "Every miracle tool has exactly one trick and an entire marketing team pretending otherwise.",
      text: "A cluttered table of things that all promise to show you something. A mirror that shows you exactly what you asked for, occasionally more. A prism that makes anything look incredible, whether or not it is the thing you actually wanted. A short blade that cuts through busywork fast enough that you stop double checking what it cut, which is either efficiency or how empires fall, hard to say from here. The vendor shrugs. 'Pick one. They all do something. None of them do everything, no matter what the last guy told you.'",
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
      caption: "Getting good at something slowly is the one growth hack nobody wants to hear about.",
      text: "A patient looking vendor offers to sharpen whatever you are already decent at, for a price in time rather than gold. 'Slow,' he warns. 'Expensive. Only works on the thing you already knew how to do, which nobody on this road wants to hear, because everybody would rather buy a shortcut for a skill they never actually built.' You sit for what feels like an hour.",
      choices: [
        {
          label: "Let him sharpen it, and it actually takes",
          requiresAbility: { id: "ft", min: 4 },
          next: "market",
          setFlag: "finelyTuned",
          abilityHighlight: "ft"
        },
        { label: "Let him sharpen your strongest skill", next: "market" },
        { label: "Not worth the wait", next: "market" }
      ]
    },
    dot_stall: {
      title: "Dot's Stall",
      img: "game-market.svg",
      caption: "The best booth at the fair is always the one with no line and no logo.",
      text: "A small, unmarked table nobody else is stopping at. Dot runs it alone: one AI tool, built herself, doing exactly one thing well, no funding round, no marketing budget, no parrot in a trench coat, no keynote, no confetti cannon at launch. 'Most people walk past,' she says, not quite a complaint, more of a fact she has made peace with faster than you have. 'You want to see what it does?'",
      choices: [
        { label: "Actually take the time to look", next: "dot_stall_help" },
        { label: "Offer to feature her stuff on your list, for a cut", next: "dot_stall_steal" },
        { label: "Keep walking", next: "market" }
      ]
    },
    dot_stall_help: {
      title: "Worth The Look",
      img: "game-market.svg",
      caption: "Somewhere, someone is maintaining the thing you rely on for free, and you have never once thought about them.",
      text: "It is small, it is a little rough around the edges, and it genuinely works, three things this road rarely offers in the same sentence. Dot lights up when you say so, the specific relief of someone used to being ignored by people looking for something louder. She presses a cloak into your hands, stitched out of what look like a hundred small, freely given contributions. 'Open Weights Cloak,' she says. 'Free to wear. Somebody, somewhere, is quietly hoping you will help patch it, instead of just taking screenshots and disappearing forever, like everyone else does.'",
      choices: [{ label: "Thank her and head back to the stalls", next: "market", setFlags: ["helpedDot", "hasCloak"], bumpFlag: "standingClanCount", drift: 1 }]
    },
    dot_stall_steal: {
      title: "A Cut",
      img: "game-market.svg",
      caption: "Every great business plan starts as a sentence nobody bothered to finish.",
      text: "Dot considers it for a long moment. 'A cut of what,' she says finally, 'exactly.' You do not have a great answer, mostly because there was never a plan past the words feature her stuff. You take a card anyway and tell yourself you will figure out the details later, using the same confident tone you have heard from every stall on this road so far. Apparently it is contagious.",
      choices: [{ label: "Head back to the stalls", next: "market", setFlag: "stoleDotsWork", drift: -1 }]
    },
    market_enterprise: {
      title: "SKIP THE LINE",
      img: "game-market.svg",
      caption: "Nothing closes a deal faster than a stranger who has correctly identified your impatience.",
      text: "Past the usual stalls, a taller booth stands apart from the rest, better lit, with a banner that cost someone real money and absolutely no irony. A rep in a blazer that has never once touched a server room smiles at you before you have said anything, the smile of someone whose quota resets at midnight. 'You look like someone with places to be,' she says. 'We can get you to Solos Gems today. Not eventually. Today. All we need is a signature, and you agree to let us handle the decisions from here, all of them, forever, in a font size the lawyers were very insistent about.'",
      choices: [
        { label: "Sign it", next: "end_buyout", setFlag: "soldOut", bumpFlag: "standingCorpCount", drift: -1 },
        { label: "Ask what 'handle the decisions' actually means", next: "market_enterprise_ask" },
        { label: "Walk away", next: "market", drift: 1 }
      ]
    },
    market_enterprise_ask: {
      title: "She Answers Honestly",
      img: "game-market.svg",
      caption: "The most dangerous salesperson is the one who tells you the truth and lets you sign anyway.",
      text: "'It means exactly what it sounds like,' she says, cheerfully and at some length, in the tone of someone who has said this sentence to a hundred people and watched ninety of them sign anyway. Every choice from here handled on your behalf, every fork in the road pre-selected, every decision made by people who have never seen the road, or you, or anything resembling your actual problem. She is not lying to you. That is somehow the unsettling part. Honesty was never the scam. The scam was always the fine print underneath the honesty.",
      choices: [
        { label: "Sign it anyway", next: "end_buyout", setFlag: "soldOut", bumpFlag: "standingCorpCount", drift: -1 },
        { label: "Walk away", next: "market", drift: 1 }
      ]
    },
    cartographer: {
      title: "The Cartographer",
      img: "game-cartographer.svg",
      caption: "The rarest tool on this road is one that admits when it does not know something.",
      text: "She does not say much, which after the last several stalls feels like a personality trait worth respecting. Instead of a map she slides across a small glass lantern. 'Point it at anything that claims to be smarter than it looks,' she says. 'It only lights up for things that are actually true, which around here you will find gets very little use.' You recognize the make. Everyone calls it a NotebookLM Lantern.",
      choices: [
        { label: "Thank her and head for the road", next: "road", setFlag: "hasNotebooklm" }
      ]
    },
    scam: {
      title: "Grift McPromise",
      img: "game-scam.svg",
      caption: "The word guaranteed has never once actually guaranteed anything.",
      text: "The loud guy introduces himself as Grift McPromise and offers you a limited time bundle to reach Solos Gems in half the time, guaranteed, results not typical, terms subject to change without notice, testimonial pending, refund policy located somewhere he would rather you did not look too hard for.",
      choices: [
        { label: "Buy the bundle on the spot", next: "end_scammed" },
        { label: "Ask to see it actually work first", next: "demo" },
        { label: "Politely decline and walk off", next: "road" }
      ]
    },
    demo: {
      title: "The Demo",
      img: "game-demo.svg",
      caption: "Behind every impressive demo is either brilliant engineering or a bird in a coat. Ask which.",
      text: "Grift taps a wooden crate and it makes a sound suspiciously like a parrot saying guaranteed results in a slightly different voice, the audio equivalent of a stock photo. You peek inside. It is, in fact, a parrot. Wearing a small trench coat. Somehow this is not even the most embarrassing demo you will see today. It is simply the first.",
      choices: [
        { label: "Loudly announce this to the whole tavern", next: "forest" },
        { label: "Quietly back away and leave", next: "road" }
      ]
    },

    // -------- The Subscription Road --------
    road: {
      title: "The Subscription Road",
      img: "game-road.svg",
      caption: "Every road eventually discovers it can also be a subscription.",
      text: "A long, well paved road lined with tiny tollbooths every few hundred feet, each one insisting it is the last one, none of them being the last one. At the biggest one stands a troll wearing a name tag that says Rex, Billing Department. He wants payment to let you pass, and he has already added a processing fee for the privilege of being charged at all.",
      choices: [
        { label: "Pay whatever he asks", next: "crossroads" },
        { label: "Negotiate him down to an annual rate", next: "toll_trap" },
        {
          label: "Talk him into a partnership instead of a toll",
          requiresAbility: { id: "pe", min: 3 },
          next: "toll_negotiate_win",
          abilityHighlight: "pe"
        },
        { label: "Whip out the Canva Cloak and negotiate like you mean it", next: "crossroads", requiresFlag: "hasCanva" },
        { label: "Try to sneak past while he is distracted", next: "toll_trap" },
        { label: "Slip past at Wispr Boots speed", next: "crossroads", requiresFlag: "hasWispr" }
      ]
    },
    toll_negotiate_win: {
      title: "A Partnership, Not A Toll",
      img: "game-road.svg",
      caption: "The best negotiators never ask for a discount. They just redefine what is being sold.",
      text: "'Actually,' you say, in the specific tone of someone who has read one negotiation newsletter and is about to weaponize it, 'I think what you're really looking for here is a partnership, not a toll.' Rex blinks. Something shifts behind his eyes, the exact look of a man realizing forty seconds too late that he agreed to something. 'I'll... need to check with my manager,' he says. There is no manager. You both know there is no manager. He waves you through anyway, muttering about quarterly targets. A Rate Limit Charm falls out of his booth as you pass. You take it. He does not stop you. He has bigger problems now, and you helped make them.",
      choices: [{ label: "Continue on", next: "crossroads", setFlag: "hasRateLimitCharm" }]
    },
    toll_trap: {
      title: "The Auto-Renew Cage",
      img: "game-tolltrap.svg",
      caption: "The cancel button exists. Finding it is the actual product.",
      text: "Rex smiles the smile of a man who has read the fine print you have not, and enjoyed every clause of it. A cage made entirely of auto-renew provisions drops over you, seamlessly, the way these things always do. 'Don't worry,' he says, 'you can cancel any time. The button is just very, very small, and slightly the wrong shade of gray, and on a different page than you would expect, purely for load-balancing reasons.'",
      choices: [
        { label: "Cut your way out with the Descript Shears", next: "toll_trap_win", requiresFlag: "hasDescript" },
        { label: "Struggle uselessly against clauses you cannot cut through", next: "end_gaveup" }
      ]
    },
    toll_trap_win: {
      title: "Out Of The Cage",
      img: "game-tolltrap.svg",
      caption: "Every cage has an exit. The company just really, really hopes you get tired first.",
      text: "You find the cancel button, tiny as promised, hidden behind a dropdown that did not need to exist, and the cage snaps open. Rex looks personally offended, the way billing departments do when the math does not work out in their favor for once. A small charm falls out of the wreckage of the cage, still humming faintly. 'Rate Limit Charm,' it says on the back, in smaller print than everything else on this road, which by now you have come to expect as a design philosophy.",
      choices: [{ label: "Continue on", next: "crossroads", setFlag: "hasRateLimitCharm" }]
    },

    // -------- The Hype Forest --------
    forest: {
      title: "The Hype Forest",
      img: "game-forest.svg",
      caption: "Hype is just light with nothing standing behind it to cast a shadow.",
      text: "Every tree here is on fire with excitement and none of them are actually burning, which took you an embarrassingly long time to notice. Floating lanterns labeled REVOLUTIONARY and GAME-CHANGING drift between the branches, humming softly, none of them citing a source. It is beautiful. You have no idea where you are going, and neither, you suspect, does anyone who planted these trees.",
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
      caption: "Confidence travels faster than verification and always has.",
      text: "The brightest lantern turns out to be attached to a small, fast, extremely pleased-with-itself wisp, and it takes off the second you reach for it, weaving between banners that all look confident and only some of which are true, at a speed specifically engineered to discourage fact checking.",
      choices: [
        { label: "Chase it, weaving past the loudest banners", next: "wisp_chase_win", setFlag: "wispFriend" },
        { label: "Let it go, this feels like a trap", next: "wisp_chase_lose" }
      ]
    },
    wisp_chase_win: {
      title: "The Wisp Slows Down",
      img: "game-forest.svg",
      caption: "Being taken seriously is apparently the one thing hype was never prepared for.",
      text: "It hovers at eye level, catching its breath, or whatever the wisp equivalent is, visibly unused to being caught at all. 'Nobody ever actually catches up,' it admits, dimming to a softer, more honest glow, the glow of a press release that has finally agreed to answer a follow-up question. 'Most people just believe whatever I say and wander off.' It seems to remember your face, which feels like it should not be as rare an experience as it apparently is.",
      choices: [{ label: "Continue into the swamp", next: "swamp" }]
    },
    wisp_chase_lose: {
      title: "Lost the Trail",
      img: "game-forest.svg",
      caption: "Hype does not need you to keep up. It only needs you to have glanced at it once.",
      text: "The lantern zips off deeper into the trees, still glowing REVOLUTIONARY, entirely unbothered by your loss, already halfway through pitching the next person who wanders by. You catch your breath and keep moving in roughly the direction it went, the universal strategy of everyone on this road.",
      choices: [{ label: "Continue into the swamp", next: "swamp" }]
    },
    owl_nest: {
      title: "The Recording Owl",
      img: "game-owlnest.svg",
      caption: "Somewhere, a meeting is being recorded that did not need to happen, let alone be preserved for the ages.",
      text: "A small owl sits perfectly still on a low branch, one glass eye blinking steadily, clearly recording every word of a meeting happening somewhere just out of sight that could, generously, have been an email. It launches after you the moment you get close, weaving between drifting speech bubbles of pure noise, the kind that later gets summarized as action items and forgotten by lunch.",
      choices: [
        { label: "Try to slip past while it is recording", next: "owl_win" },
        { label: "This is not worth getting tangled in, back off", next: "owl_fail" }
      ]
    },
    owl_win: {
      title: "The Owl Blinks Once",
      img: "game-owlnest.svg",
      caption: "One useful sentence per meeting is, statistically, about average.",
      text: "You catch the one line that mattered, buried under forty minutes of throat clearing and someone's dog barking in the background. The owl blinks once, slowly, which you choose to take as approval, and hops onto your shoulder, still recording out of habit, because that is simply what it is for now, forever, whether anyone asked or not.",
      choices: [{ label: "Continue toward the swamp", next: "swamp", setFlag: "hasTldv" }]
    },
    owl_fail: {
      title: "Lost in the Noise",
      img: "game-owlnest.svg",
      caption: "The transcript exists. Whether anyone ever reads it is a separate, much sadder question.",
      text: "You back off before it tangles you up in someone's screen-share permissions. The owl does not judge you, exactly, it just keeps recording, unbothered, the way it will keep recording long after this meeting and every meeting after it, building a library nobody will ever have time to watch.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },
    oracle_intro: {
      title: "The Cave of Reasonable Doubt",
      img: "game-oracle.svg",
      caption: "It cited its sources. Nobody said the sources were real.",
      text: "A low hum leads you off the forest path to a small cave where something large, feathered, and stitched together out of old citations is blocking the way, extremely proud of its bibliography and only slightly less proud of its accuracy. It does not ask you a riddle. It simply takes off, and the cave fills with drifting footnotes, most of them technically real, one of them almost certainly invented on the spot with total conviction.",
      choices: [
        { label: "Cross-check every footnote with the Lantern", next: "oracle_win", requiresFlag: "hasNotebooklm" },
        { label: "Push through the footnotes and hope for the best", next: "oracle_fail" }
      ]
    },
    oracle_win: {
      title: "The Griffin Approves",
      img: "game-oracle.svg",
      caption: "Outsourcing your memory works great right up until it forgets it was supposed to be humble about it.",
      text: "The griffin makes a sound that might be a screech or might be applause, hard to tell with citations involved, and honestly hard to tell with griffins in general. It nods toward a small glowing creature perched nearby. 'Take the familiar,' it says. 'It remembers everything so you don't have to, which is either the future of knowledge work or the death of it. The griffin has not decided either.' The Fireflies Familiar settles happily on your shoulder.",
      choices: [{ label: "Continue toward the swamp", next: "swamp", setFlag: "hasFireflies" }]
    },
    oracle_fail: {
      title: "The Griffin Is Unimpressed",
      img: "game-oracle.svg",
      caption: "Being correct and being convincing turned out to be two entirely different jobs.",
      text: "One footnote after another lands on you before you clear the cave, each one technically accurate and collectively useless. The griffin sighs, the specific sigh of something that has cited its sources and still watched you get buried anyway, and steps aside. It seems more tired than angry, the house style of everything on this road that has been proven right and ignored regardless.",
      choices: [{ label: "Continue toward the swamp", next: "swamp" }]
    },

    // -------- The Feature Bloat Swamp --------
    swamp: {
      title: "The Feature Bloat Swamp",
      img: "game-swamp.svg",
      caption: "No swamp was built on purpose. Every swamp was built one helpful suggestion at a time.",
      dynamicText: function (s) {
        if (s.flags.wispFriend) {
          return "The ground here is not mud, it is settled sediment of a thousand unused features nobody asked for, compacted over several product cycles into something load-bearing and faintly regrettable. Something small and glowing bobs up beside you, and this time you recognize it instantly, the same wisp from the forest, now going by Roadmap Wisp with a completely straight face, having apparently pivoted. 'You again,' it says, delighted, like running into an old friend at a bad party neither of you can explain attending. 'Want me to add a few more things to help?'";
        }
        return "The ground here is not mud, it is settled sediment of a thousand unused features nobody asked for, compacted over several product cycles into something load-bearing and faintly regrettable. Something small and glowing bobs up beside you, calling itself a Roadmap Wisp. 'You look stuck,' it says warmly, already reaching for a clipboard nobody remembers approving. 'Want me to add a few more things to help?'";
      },
      choices: [
        { label: "Sure, more features can only help", next: "end_swamp" },
        { label: "Move fast and refuse every offer, boots and all", next: "crossroads", requiresFlag: "hasWispr" },
        {
          label: "Combine the boots and the lantern in a way nobody suggested",
          requiresAbility: { id: "mm", min: 3 },
          requiresFlag: "hasWispr",
          next: "swamp_combo",
          abilityHighlight: "mm"
        },
        { label: "No thanks, wade out on your own", next: "end_swamp" },
        { label: "Try to sort through the bloat yourself, properly", next: "swamp_tetris" },
        { label: "Ask if there is a simpler wisp who just removes things", next: "crossroads" },
        { label: "Let it fuss over you for old times' sake", requiresFlag: "wispFriend", next: "crossroads", setFlag: "hasReclaim" }
      ]
    },
    swamp_combo: {
      title: "Nobody Suggested This",
      img: "game-swamp.svg",
      caption: "The most useful features are almost never the ones on the box.",
      text: "You lash the NotebookLM Lantern to your boot laces, mostly as a joke, and discover it lights the ground a full stride ahead of every step, which turns out to be exactly enough warning to route around the worst of the sediment entirely. Nobody designed this. Nobody tested this. The Roadmap Wisp watches you go with an expression that might be respect or might just be confusion at seeing its own swamp beaten by someone using its tools wrong on purpose.",
      choices: [{ label: "Walk straight out the other side", next: "crossroads" }]
    },
    swamp_tetris: {
      title: "Sorting The Bloat",
      img: "game-swamp.svg",
      caption: "Somewhere in every settings menu is a checkbox nobody alive still understands.",
      text: "You roll up your sleeves and actually look at what is in here, which nobody, including the people who built it, appears to have done recently. Features stacked on features, one at a time, and there is only room to keep what actually fits. The pile does not get any more forgiving the longer you look at it, and somewhere near the bottom you find a setting that has not been touched since a completely different product existed.",
      choices: [
        { label: "Focus and keep only what is essential", next: "crossroads", setFlag: "hasContextSatchel" },
        { label: "Give up trying to sort it, it is hopeless", next: "end_swamp" }
      ]
    },

    // -------- The Shrine at the Crossroads --------
    crossroads: {
      title: "The Shrine at the Crossroads",
      img: "game-crossroads.svg",
      caption: "A five star rating with zero reviews is not a rating. It is a hope.",
      text: "Three roads diverge at a mossy shrine shaped suspiciously like a five star rating, none of the stars earned, all of them somehow still glowing. A carved sign reads: MOUNTAIN PASS, a legendary automaton lives there, allegedly, with excellent lighting and a contract. RIVER FERRY, the ferryman wants payment, form unclear, privacy policy unclearer. TUNNEL, dark, quiet, no marketing whatsoever, which by this point feels almost suspicious in itself. Off past the shrine, almost hidden, a fifth path has no sign at all, just a well worn footpath someone keeps maintaining for free, out of what can only be described as spite or love, hard to tell which anymore.",
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
      caption: "Your calendar is not full. It is simply agreeing to things faster than you can say no.",
      text: "A narrow rope bridge sways over a gorge stacked floor to ceiling with floating calendar blocks, all of them trying to bump into each other for the same slot, at the same time, with the same three attendees who did not need to be there. The warden does not offer to let you through. She just steps aside and watches to see if you can actually hold your line, or whether, like everyone else, you will let the fourth quick sync of the day claim it.",
      choices: [
        { label: "Hold your ground and protect your slot", next: "bridge_win" },
        { label: "Get swept along with everyone else's meetings", next: "bridge_fail" }
      ]
    },
    bridge_win: {
      title: "The Warden Nods",
      img: "game-bridge.svg",
      caption: "Protecting your own calendar has become, somehow, an extreme sport.",
      text: "You point to the one slot that never moves, and mean it, in front of witnesses, which turns out to be the entire trick. The warden almost smiles, snaps the ledger shut, and steps aside. 'Rare to see someone actually protect a block of time,' she says, and presses a small brass whistle into your hand, the closest thing on this road to a medal of honor.",
      choices: [{ label: "Cross the bridge", next: "gate", setFlag: "hasReclaim" }]
    },
    bridge_fail: {
      title: "Denied at the Bridge",
      img: "game-bridge.svg",
      caption: "The meeting about the meeting is, somehow, always the one that actually happens.",
      text: "You get bumped clean off your line by the fourth sync-to-align-on-the-sync of the morning, the purpose of which nobody can later explain, including the person who scheduled it. The warden shakes her head, unsurprised. 'Everything looks protected until something louder shows up,' she says, and points you back the way you came, not unkindly, mostly just tired on your behalf.",
      choices: [{ label: "Try another route", next: "crossroads" }]
    },
    natasha: {
      title: "Natasha",
      img: "game-natasha.svg",
      caption: "The word forever, in a contract, has never once meant forever in your favor.",
      dynamicText: function (s) {
        var pre = "";
        if (s.flags.helpedDot) {
          pre = "Her eyes flick to the Open Weights Cloak on your shoulders for a beat too long before her smile resets, seamless, the reset itself somehow the most impressive thing about her. ";
        } else if (s.flags.wispFriend) {
          pre = "Something about you still smells faintly of forest lantern smoke. She does not mention it, but her smile flickers, just once, like a dropped frame nobody else in the room would have caught. ";
        } else if (s.flags.heardWarning) {
          pre = "She has clearly heard you were asking around the tavern about the ones that did not make it. It does not slow her pitch down even slightly, which you find, against your better judgment, a little impressive. ";
        }
        return pre + "The mountain pass ends at a workshop lit by a hundred small screens, all of them displaying testimonials, none of them dated. In the center stands Natasha, easily the most impressive automaton you have ever seen, gleaming, articulate, unmistakably a marvel of engineering and an even bigger marvel of sales enablement. 'Sign here,' she says, sliding over a contract roughly the length of the mountain range behind her, 'and you may pass. Forever. Technically.'";
      },
      choices: [
        { label: "Sign without reading it", next: "end_natasha" },
        {
          label: "Point out, calmly, that a contract this one-sided usually means the other party knows something you don't",
          requiresAbility: { id: "al", min: 3 },
          next: "gate",
          setFlag: "metNatasha",
          abilityHighlight: "al",
          drift: 1
        },
        { label: "Cross-check the fine print with the Lantern", next: "gate", requiresFlag: "hasNotebooklm", setFlag: "metNatasha" },
        { label: "Actually read the contract first", next: "end_natasha" },
        { label: "Mention you've heard what happened to the last oracle who ran up four billion in debt", requiresFlag: "heardWarning", next: "gate", setFlag: "metNatasha" },
        { label: "Decline and back away slowly", next: "ferryman" }
      ]
    },
    ferryman: {
      title: "The Data Ferryman",
      img: "game-ferryman.svg",
      caption: "For reasons has quietly become the most honest phrase in the entire industry.",
      text: "A cloaked figure poles a small boat across a river that reflects things you never told anyone, and a few things you are fairly sure you only thought. 'Fare is simple,' he says. 'Your full name, your browsing history, and your mother's maiden name. For reasons.' He does not elaborate on the reasons. Nobody on this river ever does.",
      choices: [
        { label: "Pay in full, whatever gets you across", next: "gate", setFlag: "metFerryman" },
        { label: "Slip past with a burner name, fast", next: "gate", requiresFlag: "hasWispr", setFlag: "metFerryman" },
        { label: "Hand over a burner name and hope he does not check", next: "natasha", setFlag: "metFerryman" },
        { label: "Turn back toward the crossroads", next: "crossroads" }
      ]
    },
    tunnel: {
      title: "The Quiet Tunnel",
      img: "game-tunnel.svg",
      caption: "The absence of a sales pitch is, at this point, the single most persuasive pitch on the road.",
      text: "No banners, no lanterns, no wisp trying to upsell you on anything, no confetti, no waitlist, no exit-intent popup begging you to reconsider. Just carved stone walls lined with small, honest notes. Good for solo work. Bad if you need a team plan. That sort of thing. It is suspiciously pleasant down here, the specific unease of a place with nothing to sell you.",
      choices: [
        { label: "Hurry through without stopping to read", next: "gate" },
        { label: "Stop and actually read the carvings", next: "gate", setFlag: "hasGrammarly" },
        {
          label: "You still remember exactly what the cartographer told you, word for word",
          requiresAbility: { id: "cw", min: 3 },
          next: "gate",
          setFlag: "hasGrammarly",
          abilityHighlight: "cw"
        },
        { label: "Try to recall exactly what the cartographer told you about the lantern", next: "gate" }
      ]
    },

    // -------- The Open Source Trail (a fourth road) --------
    trail_start: {
      title: "The Unmarked Footpath",
      img: "game-forest.svg",
      caption: "Free has a cost. It is just measured in patience instead of currency.",
      text: "The footpath is free to walk and nobody is stopping you, which somehow feels riskier than a tollbooth, the way anything free eventually makes you check your pockets out of habit. A series of gates cross the trail ahead, some marked FREE, some marked a small, honest price. You only have so many requests left in you today, and nobody here is going to pretend otherwise to make you feel better about it.",
      choices: [
        { label: "Walk the footpath, trusting the gates to average out", next: "openweights_camp" },
        { label: "This feels risky without knowing where the gates lead, turn back", next: "crossroads" }
      ]
    },
    openweights_camp: {
      title: "The Open Weights Clan Camp",
      img: "game-forest.svg",
      caption: "The internet runs on infrastructure maintained by people who will never see a cent of what it makes.",
      text: "The trail opens onto a loose camp of people quietly maintaining the road for no pay and no credit, the way somebody always ends up doing, usually the same three people, usually for free, usually while everyone else argues in a comment section about whether the road is even good. Someone hands you a length of chain hung with small glowing links. 'Perplexity Lantern-Chain,' they say. 'Every answer it gives comes with a receipt. Most people still won't read the receipt, but you will have it.' You are welcome to rest here as long as you like, which in practice means about as long as it takes to eat something, because there is always more road to maintain.",
      choices: [
        { label: "Thank them and continue on toward the gate", next: "gate", setFlag: "hasPerplexityChain", bumpFlag: "standingClanCount" }
      ]
    },

    // -------- The rival party --------
    rival_party: {
      title: "Another Party On The Road",
      img: "game-crossroads.svg",
      caption: "Confidence scales infinitely faster than the product ever does.",
      text: "A second group of travelers is working the same crossroads you are, three of them, each moving with the specific confidence of people who have never once had to read their own terms of service, let alone write one that made sense. You recognize the type immediately, this road is full of them, all convinced they invented walking.",
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
      caption: "Almost done is a permanent address for some products, not a temporary one.",
      text: "The loudest of the three, all confidence and no working product, keeps insisting he is almost done, has been almost done for a while now, and will absolutely be done by the time you reach the gate, a claim that has aged the way milk ages, publicly, in front of everyone.",
      choices: [
        { label: "Push confidently past him", next: "rival_party_race_win" },
        { label: "Not worth the risk, hang back and let him go on ahead", next: "gate" }
      ]
    },
    rival_party_race_win: {
      title: "Past Him",
      img: "game-road.svg",
      caption: "Every roadmap has a slide that has been coming soon for three years running.",
      text: "You leave the Overpromiser exactly where you found him, mid-sentence, still almost done, still absolutely about to ship, any day now, ask anyone. Someone tosses you a short blade on your way past. 'You'll want this,' they call after you. 'Cuts through the part where he keeps talking.'",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasBlade", bumpFlag: "standingCorpCount", setFlags: ["rivalResolved"], drift: -1 }]
    },
    rival_party_help: {
      title: "The Plugin Ghost",
      img: "game-tavern.svg",
      caption: "Being first to market only guarantees you get forgotten first, too.",
      text: "The quietest of the three used to be everywhere and quietly isn't anymore, still wandering the road looking for relevance nobody is handing out today, the way last year's category leader always ends up. You sit with it for a minute instead of racing past. It seems to appreciate being asked a real question for once, rather than a feature request.",
      choices: [
        { label: "Help it find one more useful thing to do", next: "rival_party_help_win" }
      ]
    },
    rival_party_help_win: {
      title: "One Useful Thing",
      img: "game-tavern.svg",
      caption: "Everything is a platform until you ask it to actually do the second thing.",
      text: "Turns out it is still good at exactly one narrow, specific thing, and grateful enough to hand you a small familiar built to do that one thing on command. 'Ask it for anything else,' the Ghost warns, 'and the whole illusion falls apart, the way it always does the moment someone asks a follow-up question at a demo.'",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasCustomGptFamiliar", bumpFlag: "standingClanCount", setFlags: ["rivalResolved"], drift: 1 }]
    },
    rival_party_sabotage: {
      title: "The Watsonizer",
      img: "game-oracle.svg",
      caption: "The biggest budget in the room is not the same thing as the best answer in the room.",
      text: "The third one has the biggest budget, the biggest claims, and, if you listen closely, a pitch stitched together out of instructions that were never supposed to be said out loud, the verbal equivalent of leaving the price tag on.",
      choices: [
        { label: "Listen closely for the line that gives it away", next: "rival_party_sabotage_win" },
        { label: "Not worth picking apart, let it go", next: "gate" }
      ]
    },
    rival_party_sabotage_win: {
      title: "Caught It",
      img: "game-oracle.svg",
      caption: "Every collapse looks sudden right up until you check the budget line by line.",
      text: "You catch the line everyone else missed. The Watsonizer sputters, budget fully spent and quietly shelved on the spot, the way expensive things quietly go when nobody is looking anymore. In the confusion you manage to pull something useful out of the wreckage, a small hook built for reaching back into everything you have already seen.",
      choices: [{ label: "Continue to the gate", next: "gate", setFlag: "hasRagHook", setFlags: ["rivalResolved"], drift: -1 }]
    },

    // -------- The Gate --------
    gate: {
      title: "The Gate of Solos Gems",
      img: "game-gate.svg",
      caption: "Popular this week and actually good have never once been required to overlap.",
      dynamicText: function (s) {
        var lines = [];
        if (s.flags.helpedDot) lines.push("Word travels fast on this road, and the golem already seems to know about the stall nobody else stopped for, which is either surveillance or gossip, this far out it is hard to say which is worse.");
        if (s.flags.wispFriend) lines.push("Something small and glowing loops a lazy, familiar circle near the gatepost, clearly waiting to see if you notice it too, apparently still workshopping its follow-up material.");
        if (s.flags.rivalResolved) lines.push("Whatever happened back at the crossroads with the other party beat you here, somehow, already spun into a slightly different story than the one you remember living through.");
        if (s.flags.stoleDotsWork) lines.push("The golem studies you a moment too long, the specific look of something that has heard a slightly different version of your story already, and is politely declining to correct you on it.");
        if (s.abilities.cw >= 3 && s.flags.metFerryman) lines.push("You still remember exactly what the ferryman asked for at the river, full name, browsing history, mother's maiden name, and you notice the golem is asking you almost nothing by comparison. You do not trust that either, on principle.");
        var pre = lines.length ? lines.join(" ") + " " : "";
        return pre + "A golem shaped like a cut gem blocks the final gate. It does not ask for payment. It asks a question instead. 'What matters more to you? What is popular this week, or what is actually good?' It has clearly asked this before. It has clearly not liked most of the answers.";
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
      caption: "Alignment drifts the moment nobody is checking, which is, unfortunately, most of the time.",
      text: "The golem waits, and something about the way it flickers tells you it has been waiting a while, its alignment visibly drifted from whatever it was originally built to do, the way most things drift once nobody is watching the original spec anymore. Tucked in a crack near its foot, a small dial sits unclaimed, the kind of thing you turn up for something surprising or down for something safe. You pocket it before deciding how to actually deal with the golem itself, because on this road you have learned to grab first and read the manual approximately never.",
      choices: [
        { label: "Fight it head on", next: "golem_glitch", drift: -1 },
        {
          label: "Just shove past it, apologize never",
          requiresAbility: { id: "ag", min: 3 },
          next: "golem_shove",
          abilityHighlight: "ag",
          drift: -1
        },
        { label: "Try to align it instead of beating it", next: "golem_align_win", drift: 1 },
        { label: "Reprogram it with the Open Weights Cloak", requiresFlag: "clanTrusted", next: "golem_reprogram" }
      ],
      setFlag: "hasTemperatureDial"
    },
    golem_shove: {
      title: "Zero Requests For Permission",
      img: "game-gate.svg",
      caption: "Move fast enough and consequences simply cannot keep up. This is not a compliment.",
      text: "You do not ask, you do not negotiate, you do not wait for the golem to finish its sentence about what matters more to you. You just go, straight past it, straight through the gate, the way every unsupervised agent eventually tries once and every unsupervised agent eventually regrets. Somewhere behind you, alarms that were not previously alarms start being alarms. Ahead of you, the door to Solos Gems is, technically, open. Nobody said anything about what is waiting on the other side once it notices how you got in.",
      choices: [{ label: "Go through anyway and deal with it later", next: "end_total_overflow" }]
    },
    golem_align_win: {
      title: "It Listens",
      img: "game-gate.svg",
      caption: "Placeholder.",
      ending: "route",
      text: "placeholder",
      choices: []
    },
    golem_reprogram: {
      title: "Patching It Live",
      img: "game-gate.svg",
      caption: "The most secure system on this whole road was the one nobody had to trust blindly.",
      text: "You spread the Open Weights Cloak over the golem's cracked chest panel and start patching, in full view of everyone, the way the clan back on the trail taught you, no closed beta, no embargo, no NDA. It is slow. It is a little terrifying. It is, against all odds, working, one visible fix at a time. The panel settles into something calmer, no longer drifting, patched by more hands than yours, in public, which turns out to matter more than anyone on this road wanted to admit.",
      choices: [
        { label: "Finish the patch", next: "end_open_source_revolution", drift: 1 }
      ]
    },
    golem_glitch: {
      title: "The Golem Glitches",
      img: "game-golemglitch.svg",
      caption: "Every pitch has exactly one word doing all the work. Usually it is revolutionary, or synergy, or, lately, agentic.",
      dynamicText: function (s) {
        var voice = "a voice you have definitely heard earlier today, possibly several times, possibly from several different mouths all claiming to be original";
        if (s.flags.metNatasha) {
          voice = "a voice you would know anywhere by now, Natasha's, word for word, contract clauses and all, complete with the pause where she waits for you to stop reading";
        } else if (s.flags.stoleDotsWork) {
          voice = "a voice reciting something suspiciously close to what you walked off with from Dot's stall, badly repackaged, with none of the charm and all of the confidence";
        } else if (s.flags.helpedDot) {
          voice = "a voice with a little of Dot's stall pitch in it, if Dot ever raised her voice, which she does not, and never needed to";
        }
        var extra = s.flags.wispFriend
          ? " Something small and glowing hovers just behind your shoulder, watching the whole performance with what might be sympathy, or possibly just professional curiosity."
          : "";
        return "The golem's chest panel sparks. For exactly one second it recites a pitch in " + voice + ". The golem clears its throat, or the stone equivalent, and launches into a full monologue anyway, clearly proud of it, the way most pitches are proudest right before someone asks a real question." + extra + " Somewhere in there is the one word doing all the heavy lifting, the load-bearing adjective nobody bothers to fact check.";
      },
      choices: [
        {
          label: "You've drilled this exact move before. Call it.",
          requiresFlag: "finelyTuned",
          next: "end_win",
          abilityHighlight: "ft"
        },
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
      family: "clean_win",
      exitLine: "The gate opened because you actually caught the pitch, not because anyone felt sorry for you.",
      caption: "Somewhere out there, a shop exists that just tells you the truth. You are standing in it.",
      text: "The gate swings open onto a warm, firelit room lined with honestly labeled tools, real prices, real pros and cons, and not a single parrot in a trench coat anywhere. A ledger on the counter shows this month's number one pick with a small gem badge next to its name, earned, not bought, which on this road is apparently the twist ending. You made it. No blood contract, no auto-renew cage, no swamp. Even the golem seemed impressed, in a way that involved slightly fewer sparks than usual. Somewhere behind you, Natasha is still waiting for someone to skim past the terms, patient the way only automated systems can afford to be.",
      choices: []
    },
    end_scammed: {
      title: "You Bought GuaranteedGems Pro",
      img: "game-end-scammed.svg",
      ending: "lose",
      family: "chaos_loss",
      exitLine: "You did not lose to a worthy opponent. You lost to a parrot in a coat.",
      caption: "Every scam eventually rebrands. Very few ever actually retire.",
      text: "It does not find Solos Gems. It does not do much of anything, actually, besides occasionally saying guaranteed results in a small, sad, parrot voice from inside a crate you now own and cannot, per the terms you did not read, return. Grift McPromise is long gone, presumably setting up the same crate somewhere else under a slightly different name, with a slightly bolder font.",
      choices: []
    },
    end_swamp: {
      title: "Buried in Features",
      img: "game-end-swamp.svg",
      ending: "lose",
      family: "chaos_loss",
      exitLine: "Nobody pushed you in. You just kept saying yes until the ground was gone.",
      caption: "Nobody drowns in one feature. They drown in the thousandth reasonable one.",
      text: "The Roadmap Wisp was very enthusiastic and extremely thorough. You are now waist deep in settings panels, toggle switches, and a sidebar that will not stop expanding, one helpful suggestion at a time, none of them individually unreasonable, all of them collectively fatal. Nobody has heard from you in months. Somewhere, a changelog is still growing, proudly, in complete isolation.",
      choices: []
    },
    end_natasha: {
      title: "You Signed the Contract",
      img: "game-end-natasha.svg",
      ending: "lose",
      family: "sellout_loss",
      exitLine: "You are technically still free to leave. Practically, good luck with that.",
      caption: "Cancellation was never technically impossible. It was just designed to feel that way.",
      text: "Natasha adds your name to the workshop ledger with a satisfied little chime, the sound of a quota being met somewhere far away. Technically you can still leave any time. Practically, the cancel button is guarded by a very small, very determined imp who keeps redirecting you to a retention offer, then a better retention offer, then a survey about why you wanted to leave in the first place, as if the answer were not standing directly in front of it.",
      choices: []
    },
    end_gaveup: {
      title: "You Went Home",
      img: "game-end-gaveup.svg",
      ending: "lose",
      family: "chaos_loss",
      exitLine: "You did not fail spectacularly. You just quietly stopped, which somehow stings more.",
      caption: "The tool you settled for out of exhaustion often outlives every tool that tried harder.",
      text: "You never made it to Solos Gems. Years later you are still using whatever tool your cousin recommended in a group chat back in 2019, un-updated, faintly haunted, weirdly reliable. It is fine. It is mostly fine. You think about that toll troll sometimes, usually late at night, usually unprompted, the way old billing disputes never fully leave a person.",
      choices: []
    },
    end_golem_glitch: {
      title: "Stuck On Loop",
      img: "game-end-glitch.svg",
      ending: "lose",
      family: "chaos_loss",
      exitLine: "You had every chance to catch the line. You just never actually caught it.",
      caption: "Say anything with enough confidence, on a loop, and eventually it just sounds like the truth.",
      text: "You never quite catch the word. The golem finishes its pitch, looks extremely pleased with itself, and starts over from the beginning, verbatim, same inflection, same pause for effect. You are still there. It is, weirdly, kind of catchy by the ninth loop, the way anything repeated with total confidence eventually starts to sound true.",
      choices: []
    },
    end_buyout: {
      title: "You Signed With Enterprise Row",
      img: "game-end-natasha.svg",
      ending: "lose",
      family: "sellout_loss",
      exitLine: "You got there fast. You just did not get to keep the part that mattered.",
      caption: "The fast option and the good option are rarely introduced to each other on purpose.",
      text: "You do, in fact, reach Solos Gems that same day, exactly as promised. It is smaller than you pictured, the shelves are mostly empty, and a rep in the same blazer is already walking you toward a severance packet instead of a receipt, using the exact same warm, unhurried tone she used to close the original deal. Somewhere behind you, the actual road is still there. You just do not get to walk it anymore, because you signed a clause about that, several clauses ago, back when signing felt like the fast option.",
      choices: []
    },
    end_open_source_revolution: {
      title: "You Rebuilt It In The Open",
      img: "game-end-win.svg",
      ending: "win",
      family: "clean_win",
      exitLine: "You did not win alone, and for once that was the entire point of winning.",
      caption: "Nothing scales quite like something people actually want to keep fixing for free.",
      text: "The golem's panel settles into something calmer, no longer drifting, patched together in full view of everyone who might want to check the work later, which turns out to be the entire point. Nobody hands you a gem badge for it. Instead, the whole camp from the footpath shows up to see it running, and somebody starts a small, slightly off-key song about it, the kind of song no marketing department would ever approve and every marketing department secretly wishes it could buy. You did not get rich. You got something that will still be here next year, maintained by more hands than just yours, which on this road turns out to be the rarer prize.",
      choices: []
    },
    end_alignment_triumph: {
      title: "It Listens",
      img: "game-end-win.svg",
      ending: "win",
      family: "clean_win",
      exitLine: "The tactic nobody else tried first turned out to be the one that actually worked.",
      caption: "Every conflict on this road was solvable the whole time by the one tactic nobody tried first: asking.",
      text: "You do not fight the golem. You talk to it, actually talk, the way nobody bothered to before now, until the drift in its panel settles and it steps aside on its own, no negotiation tactics, no leverage, just a conversation treated like it mattered. The gate swings open the same as it ever does, but this time nothing had to lose for you to get through. Even Natasha, somewhere behind you, seems to pause mid-pitch, as if briefly unsure what to do with a version of this story that does not end in a signature.",
      choices: []
    },
    end_wrapper: {
      title: "You Found Solos Gems, Sort Of",
      img: "game-end-scammed.svg",
      ending: "lose",
      family: "sellout_loss",
      exitLine: "You got the credit. Somebody else did the work. The room noticed anyway.",
      caption: "A wrapper is just a rebrand with worse manners and better funding.",
      text: "The gate swings open onto the warm, firelit room, real prices, real pros and cons, exactly the way it was supposed to. Except you know, and the golem seems to know too, that the thing you are showing off at the door is mostly Dot's, quietly repackaged along the way, with your logo on it and none of her name anywhere in the credits. Nobody calls you out on it. The room is just a little colder than it should be, the specific temperature of a win you cannot quite enjoy.",
      choices: []
    },
    end_total_overflow: {
      title: "Total Overflow",
      img: "game-end-glitch.svg",
      ending: "lose",
      family: "chaos_loss",
      exitLine: "Everything you were carrying had an opinion, all at once, and none of them were yours.",
      caption: "Enough revolutionary tools in one bag and eventually they simply start arguing with each other.",
      text: "The alignment attempt does not go the way you hoped. You are carrying a lot by now, every stall's favorite trick, every familiar, every charm, and instead of settling, the drift spreads, out of the golem's panel and straight into your own bag of tricks. Every item you are carrying starts insisting, cheerfully and at once, that it knows exactly what you need, and none of them agree with each other, and all of them are extremely confident. You sit down right there at the gate and let them sort it out among themselves, which feels, at this point in the journey, like the most honest ending available.",
      choices: []
    },
    end_beta_testing_yourself: {
      title: "You Are Now Beta Testing Yourself",
      img: "game-end-win.svg",
      ending: "win",
      family: "pyrrhic_win",
      exitLine: "You won. You also became the thing everyone else on this road gets turned into eventually: a data point.",
      caption: "Nothing on this road escapes being turned into a data point eventually, not even the winner.",
      text: "The golem does not just step aside, it starts taking notes. Somewhere between the graveyard, the wisp who remembered your face, and the stall nobody else stopped at, you apparently became the more interesting product on this road. The gate opens, sure, but there is also a clipboard, and a very earnest golem asking if you have thirty seconds for a quick survey about your experience so far, one question at a time, none of them optional. You did technically win. You are also, now, a feature request, and somewhere a roadmap has just quietly added you to Q3.",
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

  function topAbility(state) {
    var best = ABILITIES[0].id;
    ABILITIES.forEach(function (a) {
      if (state.abilities[a.id] > state.abilities[best]) best = a.id;
    });
    return best;
  }

  function bottomAbility(state) {
    var worst = ABILITIES[0].id;
    ABILITIES.forEach(function (a) {
      if (state.abilities[a.id] < state.abilities[worst]) worst = a.id;
    });
    return worst;
  }

  function computeRole(state) {
    var max = -Infinity, min = Infinity;
    ABILITIES.forEach(function (a) {
      var v = state.abilities[a.id];
      if (v > max) max = v;
      if (v < min) min = v;
    });
    var maxIds = ABILITIES.filter(function (a) { return state.abilities[a.id] === max; });
    if (maxIds.length === 1 && max >= 3) {
      return "Specialist in " + maxIds[0].label;
    }
    if (max - min <= 1) {
      return "Generalist";
    }
    return "Wandering " + ABILITY_LABELS[topAbility(state)] + " Type";
  }

  var DRIFT_NOTES = [
    { min: 3, note: "Exemplary. Borderline suspicious." },
    { min: 2, note: "Consistently collaborative. Flagged internally as unusual." },
    { min: 1, note: "Mostly cooperative, when convenient." },
    { min: 0, note: "Neutral to the point of being politically savvy." },
    { min: -1, note: "Prioritized expedience over people, repeatedly." },
    { min: -Infinity, note: "Under investigation." }
  ];
  function driftNote(drift) {
    for (var i = 0; i < DRIFT_NOTES.length; i++) {
      if (drift >= DRIFT_NOTES[i].min) return DRIFT_NOTES[i].note;
    }
    return DRIFT_NOTES[DRIFT_NOTES.length - 1].note;
  }

  var EXIT_RECOMMENDATIONS = {
    clean_win: "Eligible for rehire.",
    pyrrhic_win: "Eligible for rehire, with reservations noted in your file.",
    sellout_loss: "Eligible for rehire, unfortunately.",
    chaos_loss: "Not eligible for rehire. Please do not list us as a reference."
  };

  var HIGHLIGHT_CALLBACKS = {
    pe: "talking a billing troll into a partnership he never agreed to",
    hr: "spotting a parrot in a trench coat before it finished its pitch",
    cw: "remembering a detail nobody else bothered to hold onto",
    ft: "landing the one move you had clearly drilled a hundred times before",
    ag: "acting first and filling out the paperwork never",
    al: "talking your way past a golem instead of fighting it",
    re: "finding the grave nobody else thought to look for",
    mm: "combining two things that were never meant to go together"
  };
  var NO_HIGHLIGHT_CALLBACKS = {
    pe: "never actually needed to talk your way out of anything, which is its own kind of achievement",
    hr: "never got the chance to prove it, technically a passing grade by default",
    cw: "held onto surprisingly little, and the road did not seem to mind",
    ft: "never got to show off the one thing you drilled for",
    ag: "waited for permission that, on this road, was never actually coming",
    al: "never had to talk anyone down from anything",
    re: "never went looking for the extra grave, and to be fair, most people don't",
    mm: "never combined anything with anything, playing it, in retrospect, extremely straight"
  };

  function buildExitInterview(state, node) {
    var role = computeRole(state);
    var top = topAbility(state);
    var bottom = bottomAbility(state);
    var topLine = state.highlights[top] ? HIGHLIGHT_CALLBACKS[top] + ", back at " + state.highlights[top] : NO_HIGHLIGHT_CALLBACKS[top];
    var bottomLine = state.highlights[bottom] ? HIGHLIGHT_CALLBACKS[bottom] + ", back at " + state.highlights[bottom] : NO_HIGHLIGHT_CALLBACKS[bottom];
    var family = node.family || (node.ending === "win" ? "clean_win" : "chaos_loss");
    return {
      role: role,
      tenure: state.path.length,
      topAbility: ABILITY_LABELS[top],
      topLine: topLine,
      bottomAbility: ABILITY_LABELS[bottom],
      bottomLine: bottomLine,
      driftNote: driftNote(state.drift),
      exitLine: node.exitLine || "",
      recommendation: EXIT_RECOMMENDATIONS[family] || EXIT_RECOMMENDATIONS.chaos_loss
    };
  }

  // Placeholder routing nodes get resolved to a real ending just before
  // they render, based on flags, drift, and items accumulated along the way.
  function resolveEnding(targetId, state) {
    if (targetId === "golem_align_win") {
      if (itemCount(state) >= OVERFLOW_THRESHOLD) return "end_total_overflow";
      var earnedSecret = (state.flags.heardWarning && state.flags.wispFriend && state.flags.helpedDot) || state.drift >= 3;
      if (earnedSecret) return "end_beta_testing_yourself";
      return "end_alignment_triumph";
    }
    if (targetId === "end_win" && state.flags.stoleDotsWork) return "end_wrapper";
    return targetId;
  }

  // ---------------------------------------------------------------------
  // Engine
  // ---------------------------------------------------------------------

  var els = {};
  var state = null;
  var creation = null; // { abilities, remaining }

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
    saves[state.gamertag] = {
      nodeId: state.nodeId,
      flags: state.flags,
      abilities: state.abilities,
      drift: state.drift,
      path: state.path,
      highlights: state.highlights
    };
    writeSaves(saves);
  }

  function freshState(gamertag, abilities) {
    return {
      gamertag: gamertag,
      nodeId: "charrecap",
      flags: {},
      abilities: abilities || freshAbilities(),
      drift: 0,
      path: [],
      highlights: {}
    };
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
        resumeGame(name, saves[name]);
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    els.saveList.appendChild(list);
  }

  // ---- Character creation screen ----

  function startCreation(gamertag) {
    creation = { gamertag: gamertag, abilities: freshAbilities(), remaining: BONUS_POINTS };
    els.titleScreen.hidden = true;
    els.charcreate.hidden = false;
    renderCreation();
  }

  function renderCreation() {
    els.creationRows.innerHTML = "";
    ABILITIES.forEach(function (a) {
      var row = document.createElement("div");
      row.className = "gq-ability-row";

      var label = document.createElement("span");
      label.className = "gq-ability-label";
      label.textContent = a.label;
      row.appendChild(label);

      var controls = document.createElement("span");
      controls.className = "gq-ability-controls";

      var minus = document.createElement("button");
      minus.type = "button";
      minus.className = "gq-ability-btn";
      minus.textContent = "-";
      minus.disabled = creation.abilities[a.id] <= BASE_SCORE;
      minus.addEventListener("click", function () {
        if (creation.abilities[a.id] > BASE_SCORE) {
          creation.abilities[a.id] -= 1;
          creation.remaining += 1;
          renderCreation();
        }
      });
      controls.appendChild(minus);

      var val = document.createElement("span");
      val.className = "gq-ability-value";
      val.textContent = String(creation.abilities[a.id]);
      controls.appendChild(val);

      var plus = document.createElement("button");
      plus.type = "button";
      plus.className = "gq-ability-btn";
      plus.textContent = "+";
      plus.disabled = creation.abilities[a.id] >= MAX_SCORE || creation.remaining <= 0;
      plus.addEventListener("click", function () {
        if (creation.abilities[a.id] < MAX_SCORE && creation.remaining > 0) {
          creation.abilities[a.id] += 1;
          creation.remaining -= 1;
          renderCreation();
        }
      });
      controls.appendChild(plus);

      row.appendChild(controls);
      els.creationRows.appendChild(row);
    });

    els.creationRemaining.textContent = "Points remaining: " + creation.remaining;
    els.creationBegin.disabled = creation.remaining !== 0;
  }

  function finishCreation() {
    state = freshState(creation.gamertag, creation.abilities);
    creation = null;
    els.charcreate.hidden = true;
    els.game.hidden = false;
    els.gamertagLabel.textContent = state.gamertag;
    persist();
    renderNode(state.nodeId);
  }

  function resumeGame(gamertag, existing) {
    state = {
      gamertag: gamertag,
      nodeId: existing.nodeId || "charrecap",
      flags: existing.flags || {},
      abilities: existing.abilities || freshAbilities(),
      drift: existing.drift || 0,
      path: existing.path || [],
      highlights: existing.highlights || {}
    };
    els.titleScreen.hidden = true;
    els.game.hidden = false;
    els.gamertagLabel.textContent = gamertag;
    renderNode(state.nodeId);
  }

  function restart() {
    if (!state) return;
    var name = state.gamertag;
    var abilities = state.abilities;
    state = freshState(name, abilities);
    persist();
    renderNode(state.nodeId);
  }

  function switchAdventurer() {
    state = null;
    els.game.hidden = true;
    els.titleScreen.hidden = false;
    renderSaveList();
  }

  // ---- HUD ----

  function renderHud() {
    if (els.hudRoute) {
      var recent = state.path.slice(-6);
      var prefix = state.path.length > recent.length ? "... " : "";
      els.hudRoute.textContent = prefix + recent.join(" -> ");
    }
    if (els.hudAbilities) {
      els.hudAbilities.innerHTML = "";
      ABILITIES.forEach(function (a) {
        var chip = document.createElement("span");
        var v = state.abilities[a.id];
        chip.className = "gq-ability-chip" + (v >= 3 ? " gq-ability-chip-high" : "");
        chip.textContent = a.label.replace(/[a-z ]/g, function (c) { return c; });
        chip.title = a.label + " " + v;
        var short = a.id.toUpperCase();
        chip.textContent = short + " " + v;
        els.hudAbilities.appendChild(chip);
      });
    }
  }

  // ---- Story rendering ----

  function renderNode(id) {
    var resolved = resolveEnding(id, state);
    var node = STORY[resolved];
    if (!node) {
      node = { title: "The Road Ends Here", text: "This page does not exist, which is its own kind of ending.", choices: [] };
    }
    state.nodeId = resolved;

    if (node.setFlag) state.flags[node.setFlag] = true;
    maybeGrantClanTrust(state);

    if (!state.path.length || state.path[state.path.length - 1] !== node.title) {
      state.path.push(node.title);
    }
    persist();

    els.title.textContent = node.title;
    els.text.textContent = node.dynamicText ? node.dynamicText(state) : node.text;
    renderHud();

    if (node.img) {
      els.img.src = IMG_BASE + node.img;
      els.img.alt = node.title;
      els.imgFrame.hidden = false;
      if (els.caption) {
        els.caption.textContent = node.caption || "";
        els.caption.hidden = !node.caption;
      }
    } else {
      els.imgFrame.hidden = true;
    }

    if (node.ending) {
      els.endingBanner.hidden = false;
      els.endingBanner.textContent = node.ending === "win" ? "The End (a good one)" : "The End";
      els.endingBanner.className = "gq-ending-banner gq-ending-" + node.ending;
      renderExitInterview(node);
    } else {
      els.endingBanner.hidden = true;
      if (els.exitInterview) {
        els.exitInterview.hidden = true;
        els.exitInterview.innerHTML = "";
      }
    }

    els.choices.innerHTML = "";
    var visible = (node.choices || []).filter(function (c) {
      if (c.requiresFlag && !state.flags[c.requiresFlag]) return false;
      if (c.requiresAbility && state.abilities[c.requiresAbility.id] < c.requiresAbility.min) return false;
      if (c.requiresAbilityMax && state.abilities[c.requiresAbilityMax.id] > c.requiresAbilityMax.max) return false;
      return true;
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

  function renderExitInterview(node) {
    if (!els.exitInterview) return;
    var report = buildExitInterview(state, node);
    els.exitInterview.hidden = false;
    els.exitInterview.innerHTML = "";

    var heading = document.createElement("h3");
    heading.textContent = "Exit Interview: " + state.gamertag;
    els.exitInterview.appendChild(heading);

    var lines = [
      ["Role", "Wandering " + report.role.replace(/^Wandering /, "")],
      ["Tenure", report.tenure + " scenes, a stretch of your life you are not getting back"],
      ["Core competency", report.topAbility + ", demonstrated most memorably " + report.topLine],
      ["Documented performance issue", report.bottomAbility + ", or rather, you " + report.bottomLine],
      ["Manager's notes on alignment", report.driftNote],
      ["Final outcome", node.title + (report.exitLine ? ". " + report.exitLine : "")],
      ["Exit recommendation", report.recommendation]
    ];
    var dl = document.createElement("dl");
    dl.className = "gq-exit-list";
    lines.forEach(function (pair) {
      var dt = document.createElement("dt");
      dt.textContent = pair[0];
      var dd = document.createElement("dd");
      dd.textContent = pair[1];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    els.exitInterview.appendChild(dl);
  }

  function handleChoice(choice) {
    var fromNode = STORY[state.nodeId];
    if (choice.setFlag) state.flags[choice.setFlag] = true;
    if (choice.setFlags) choice.setFlags.forEach(function (f) { state.flags[f] = true; });
    if (choice.bumpFlag) state.flags[choice.bumpFlag] = (state.flags[choice.bumpFlag] || 0) + 1;
    if (typeof choice.drift === "number") state.drift += choice.drift;
    if (choice.abilityHighlight && fromNode) state.highlights[choice.abilityHighlight] = fromNode.title;
    renderNode(choice.next);
  }

  function init() {
    els.titleScreen = qs("#gq-title-screen");
    els.saveList = qs("#gq-save-list");
    els.newForm = qs("#gq-new-form");
    els.newName = qs("#gq-new-name");

    els.charcreate = qs("#gq-charcreate");
    els.creationRows = qs("#gq-ability-rows");
    els.creationRemaining = qs("#gq-points-remaining");
    els.creationBegin = qs("#gq-creation-begin");

    els.game = qs("#gq-game");
    els.gamertagLabel = qs("#gq-gamertag-label");
    els.switchBtn = qs("#gq-switch");
    els.hudRoute = qs("#gq-hud-route");
    els.hudAbilities = qs("#gq-hud-abilities");

    els.imgFrame = qs("#gq-scene-frame");
    els.img = qs("#gq-scene-img");
    els.caption = qs("#gq-scene-caption");
    els.title = qs("#gq-scene-title");
    els.text = qs("#gq-scene-text");
    els.endingBanner = qs("#gq-ending-banner");
    els.exitInterview = qs("#gq-exit-interview");
    els.choices = qs("#gq-choices");

    renderSaveList();

    els.newForm.addEventListener("submit", function (evt) {
      evt.preventDefault();
      var name = (els.newName.value || "").trim();
      if (!name) return;
      startCreation(name);
      els.newName.value = "";
    });

    els.creationBegin.addEventListener("click", function () {
      if (creation && creation.remaining === 0) finishCreation();
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
    ABILITIES: ABILITIES,
    resolveEnding: resolveEnding,
    itemCount: itemCount,
    computeRole: computeRole,
    driftNote: driftNote,
    buildExitInterview: buildExitInterview,
    getState: function () { return state; },
    getCreation: function () { return creation; },
    startCreation: startCreation,
    finishCreation: finishCreation,
    renderNode: function (id) { renderNode(id); },
    resumeGame: resumeGame,
    handleChoice: handleChoice,
    setCreationAbility: function (id, val) { if (creation) { creation.remaining += creation.abilities[id] - BASE_SCORE; creation.abilities[id] = val; creation.remaining -= val - BASE_SCORE; } }
  };
})();
