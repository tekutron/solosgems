# -*- coding: utf-8 -*-
import os
import re
import json
import csv

ROOT = "/sessions/magical-ecstatic-noether/mnt/outputs/ai-solopreneur-tools"
TODAY = "2026-08-08"

# Tools added in the August 8, 2026 database-growth pass. Used to power the
# "NEW" badge and the "newest first" sort. Everything else is dated to when
# the searchable wall feature itself shipped, since we don't have a reliable
# per-tool add date further back than that.
NEW_TOOL_NAMES = {
    "Hugging Face", "LangChain", "Lindy", "eesel AI", "Granola", "Jamie",
    "Anara", "Lettuce", "Cashflowy", "LegesGPT", "Higgsfield", "PixVerse",
    "NovelAI", "ProWritingAid", "Cleanvoice",
    "Superwhisper", "Willow Voice", "Attio", "Ahrefs", "Composer",
    "Birdeye", "Ocoya", "MyArchitectAI",
}

def date_added(name):
    return TODAY if name in NEW_TOOL_NAMES else "2026-08-01"

FREE_PHRASES = [
    "free tier", "free plan", "is free", "it's free", "completely free",
    "genuinely free", "always free", "free for", "free (", "free or ",
    "no cost", "100% free", "free version", "free to use", "usable free",
    "'s free", "free, ", "free every", "no free plan doesn't apply",
]
NO_FREE_PHRASES = ["no free plan", "no free tier"]
PRICE_PATTERN = re.compile(r'\$\d|/mo\b|/month\b|/min\b|/user/month')

def free_tier(desc, cool_fact):
    text = f"{desc} {cool_fact}".lower()
    if any(p in text for p in NO_FREE_PHRASES):
        return "paid"
    has_free_phrase = any(p in text for p in FREE_PHRASES)
    has_price = bool(PRICE_PATTERN.search(text))
    if has_free_phrase and has_price:
        return "freemium"
    if has_free_phrase:
        return "free"
    if has_price:
        return "paid"
    return "unlisted"

def fav(domain):
    return f"https://www.google.com/s2/favicons?domain={domain}&sz=128"

# (name, domain, category, desc, cool_fact, link, internal)
TOOLS = [
    # AI Assistants
    ("ChatGPT", "chatgpt.com", "AI Assistants", "OpenAI's general-purpose AI chatbot, handles writing, coding, research, and image generation in one conversation.", "Became one of the fastest-growing consumer apps in history after its 2022 launch.", "https://chatgpt.com/", False),
    ("Claude", "claude.ai", "AI Assistants", "Anthropic's AI assistant, built with a focus on careful reasoning and long-context conversations.", "Can hold entire books or codebases in a single conversation thanks to its large context window.", "https://claude.ai/", False),
    ("Gemini", "gemini.google.com", "AI Assistants", "Google's AI assistant, deeply integrated across Search, Docs, Gmail, and Android.", "Natively understands images, video, and audio in the same conversation, not just text.", "https://gemini.google.com/", False),
    ("Grok", "grok.com", "AI Assistants", "xAI's chatbot, built into X (formerly Twitter) with real-time access to what's trending on the platform.", "Grok Imagine can generate images and short videos from the same chat window.", "https://grok.com/", False),
    ("DeepSeek", "deepseek.com", "AI Assistants", "An AI lab's chatbot that rivals top models while publishing its models with open weights.", "Its models can be downloaded and run by anyone, not just accessed through a paid API.", "https://www.deepseek.com/", False),
    ("Mistral Le Chat", "chat.mistral.ai", "AI Assistants", "A European AI assistant from Mistral, built with a privacy-first, GDPR-compliant approach.", "Remembers details from conversations weeks earlier, even on the free tier.", "https://chat.mistral.ai/", False),
    ("Microsoft Copilot", "copilot.microsoft.com", "AI Assistants", "Microsoft's AI assistant woven directly into Word, Excel, Outlook, and Windows itself.", "Can see and act on what's already open on your screen inside Microsoft 365 apps.", "https://copilot.microsoft.com/", False),
    ("Perplexity Pro", "perplexity.ai", "AI Assistants", "Cited, sourced AI search; a nice-to-have if you already pay for another AI assistant.", "Answers link directly back to the specific source they came from, not just a generic citation list.", "reviews/perplexity-pro.html", True),
    ("Meta AI", "meta.ai", "AI Assistants", "Meta's free AI assistant, built directly into Instagram, WhatsApp, Facebook, and Messenger.", "Runs inside the messaging apps billions of people already have open, no separate app required.", "https://www.meta.ai/", False),
    ("Poe", "poe.com", "AI Assistants", "Quora's chat platform that gives you access to dozens of different AI models under one subscription.", "Lets you compare answers from GPT, Claude, Gemini, and other models side by side in the same place.", "https://poe.com/", False),

    # AI Search & Browsing
    ("Perplexity Comet", "perplexity.ai", "AI Search & Browsing", "Perplexity's AI-native web browser that reads, researches, and can act on the page you're viewing.", "Free for all Perplexity account holders, unusual for a browser built around a paid AI subscription product.", "https://comet.perplexity.ai/", False),
    ("ChatGPT Atlas", "chatgpt.com", "AI Search & Browsing", "OpenAI's own web browser, with ChatGPT built into the sidebar and an agent mode that can complete tasks for you.", "Its agent mode can research, compare, and complete multi-step browsing tasks directly on live webpages.", "https://chatgpt.com/atlas", False),
    ("Manus", "manus.im", "AI Search & Browsing", "A general-purpose AI agent that browses the web, does research, and can publish working web apps on its own.", "Can go from a plain-language brief to a working, published web app without a developer in the loop.", "https://manus.im/", False),
    ("Kagi", "kagi.com", "AI Search & Browsing", "A paid, ad-free search engine with AI features layered on top and no ads or tracking to fund it.", "Lets you manually boost or block specific websites from ever appearing in your results again.", "https://kagi.com/", False),
    ("You.com", "you.com", "AI Search & Browsing", "An AI search engine that lets you choose which underlying model answers your query.", "Offers over 30 specialized AI agents built for different tasks like research, writing, and coding.", "https://you.com/", False),

    # Image Generation
    ("Midjourney", "midjourney.com", "Image Generation", "Distinctive AI image generation; no free plan.", "Started as a Discord bot and still runs primarily through Discord commands.", "reviews/midjourney.html", True),
    ("Stable Diffusion", "stability.ai", "Image Generation", "An open-weight image generation model that anyone can download, run locally, and fine-tune.", "Because it's open-weight, it spawned an entire ecosystem of community fine-tunes and tools built on top of it.", "https://stability.ai/", False),
    ("Ideogram", "ideogram.ai", "Image Generation", "An AI image generator that specializes in getting readable text inside the image right.", "Reaches roughly 90% accuracy rendering legible text and logos inside generated images, long a weak spot for image models.", "https://ideogram.ai/", False),
    ("Leonardo AI", "leonardo.ai", "Image Generation", "AI image generation aimed at game assets, concept art, and stylized illustration.", "Its Phoenix model and real-time canvas are popular specifically with game studios for concept art pipelines.", "https://leonardo.ai/", False),
    ("Recraft", "recraft.ai", "Image Generation", "AI image generation built for designers: brand-consistent graphics, icons, and layouts.", "One of the only AI image tools that natively outputs scalable SVG files, not just flat images.", "https://www.recraft.ai/", False),
    ("Flux", "bfl.ai", "Image Generation", "A photorealism-focused image generation model from Black Forest Labs.", "Built by former Stable Diffusion researchers, it's become a common benchmark for photorealistic AI image quality.", "https://bfl.ai/", False),
    ("Adobe Firefly", "firefly.adobe.com", "Image Generation", "Adobe's AI image and design generator, built into Photoshop, Illustrator, and Express.", "Trained specifically on licensed and public-domain content, positioned as safer for commercial use.", "https://firefly.adobe.com/", False),
    ("Freepik AI", "freepik.com", "Image Generation", "AI image generation built into Freepik's massive stock photo, vector, and template library.", "Lets you generate a new image and drop it straight into a stock template in the same workspace.", "https://www.freepik.com/ai", False),
    ("Krea AI", "krea.ai", "Image Generation", "Real-time AI image generation and upscaling, showing results as you sketch or adjust the prompt.", "Updates the generated image live as you draw or type, instead of waiting for a full render each time.", "https://www.krea.ai/", False),

    # Video Generation
    ("Runway", "runwayml.com", "Video Generation", "AI video generation and editing for solo creators, from $15/month.", "Its Act-Two feature captures a real performance and maps it onto a generated character.", "reviews/runway.html", True),
    ("Synthesia", "synthesia.io", "Video Generation", "Turns a script into a talking-avatar video, from $14/month.", "Offers 125+ AI avatars to choose from without ever appearing on camera yourself.", "reviews/synthesia.html", True),
    ("Kling AI", "klingai.com", "Video Generation", "A video generator known for realistic motion and a generous free tier.", "Its Omni mode can lip-sync two different characters in one scene, each mouth matched to its own audio track.", "https://klingai.com/", False),
    ("Luma Dream Machine", "lumalabs.ai", "Video Generation", "AI video generation known for realistic depth, camera movement, and physical space.", "Started as a 3D-capture company before pivoting to video, which shows in how well it renders room depth.", "https://lumalabs.ai/", False),
    ("Veo", "labs.google", "Video Generation", "Google's AI video generation model, built into Gemini and Google's creative tools.", "Frequently cited as one of the top overall picks for AI video quality among current models.", "https://labs.google/", False),
    ("Pika", "pika.art", "Video Generation", "An AI video generator focused on quick, stylized clips and creative effects.", "Popular for its one-click visual effects library, objects exploding, melting, and transforming.", "https://pika.art/", False),
    ("HeyGen", "heygen.com", "Video Generation", "AI avatar video generation with strong lip-sync and video translation.", "Can take a video in English and dub it into dozens of languages while matching the speaker's lips to the new language.", "https://www.heygen.com/", False),
    ("D-ID", "d-id.com", "Video Generation", "AI avatar video with an API-first design built for developers to embed into their own apps.", "Powers things like interactive museum guides and AI tutors that talk back in real time.", "https://www.d-id.com/", False),
    ("OpusClip", "opus.pro", "Video Generation", "Turns long-form video into short social clips automatically, from $15/month.", "Scores every auto-generated clip by predicted engagement before you post it.", "reviews/opusclip.html", True),
    ("CapCut", "capcut.com", "Video Generation", "ByteDance's free AI-powered video editor, built around fast short-form editing for social platforms.", "Became one of the most-used video editing apps in the world largely through organic use by short-form creators.", "https://www.capcut.com/", False),
    ("Pictory", "pictory.ai", "Video Generation", "Turns long-form video, blog posts, or scripts into short, branded video clips automatically.", "Can generate a finished short video directly from a blog post URL, no footage of your own required.", "https://pictory.ai/", False),
    ("Creatify", "creatify.ai", "Video Generation", "Turns a product link into AI avatar-led, UGC-style video ads at scale.", "Built specifically for the fast turnaround and volume that brand-deal and performance-ad work demands.", "https://creatify.ai/", False),
    ("Higgsfield", "higgsfield.ai", "Video Generation", "An AI video generation platform built around cinematic camera movement and stylized motion presets.", "Offers a library of named camera-move presets, so a specific dramatic zoom or pan can be applied with one click instead of a prompt.", "https://higgsfield.ai/", False),
    ("PixVerse", "pixverse.ai", "Video Generation", "An AI video generator focused on fast text-to-video and image-to-video clips with built-in style templates.", "Includes a library of one-click effect templates, aimed at quick social clips rather than long-form production work.", "https://pixverse.ai/", False),

    # Video Generation (localization)
    ("Rask AI", "rask.ai", "Video Generation", "AI dubbing and lip-sync that translates a video into another language, matching mouth movements to the new audio.", "Clones the original speaker's voice into 130+ languages instead of swapping in a generic narrator.", "https://www.rask.ai/", False),
    ("Kapwing", "kapwing.com", "Video Generation", "An all-in-one video editor with AI subtitles, translation, and dubbing built alongside normal editing tools.", "Handles auto-subtitles in 100+ languages and dubbing in 70+, without leaving the main editor.", "https://www.kapwing.com/", False),

    # Voice & Music
    ("ElevenLabs", "elevenlabs.io", "Voice & Music", "AI voice generation and cloning; free tier is watermarked and non-commercial.", "Can clone a convincing voice from just a short audio sample.", "reviews/elevenlabs.html", True),
    ("Suno", "suno.com", "Voice & Music", "AI music generation that turns a text prompt into a full song with vocals and structure, from $8/month billed yearly.", "Its latest model closes most of the uncanny valley in AI vocals, they sound like a real singer now.", "reviews/suno.html", True),
    ("Udio", "udio.com", "Voice & Music", "AI music generation known for coherent full songs with mixed, separable tracks.", "Exports separate vocal, drum, bass, and instrument stems so you can remix the output in real music software.", "https://www.udio.com/", False),
    ("Murf AI", "murf.ai", "Voice & Music", "AI voiceover generation aimed at studio-quality narration for videos and presentations.", "Includes a built-in voice changer that converts your own recorded voice into polished narration.", "https://murf.ai/", False),
    ("Play.ht", "play.ht", "Voice & Music", "AI text-to-speech and voice cloning aimed at podcasts, audiobooks, and apps.", "Offers ultra-realistic voice cloning from just a short audio sample.", "https://play.ht/", False),
    ("AIVA", "aiva.ai", "Voice & Music", "AI music composition built for scoring original soundtracks, from film cues to game music.", "Was recognized as the first AI to be officially registered as a composer with a music rights society.", "https://www.aiva.ai/", False),
    ("Soundraw", "soundraw.io", "Voice & Music", "Generates royalty-free AI music customized by mood, genre, and length for videos and content.", "Lets you edit the structure of a generated track, swapping sections in and out, instead of taking it as-is.", "https://soundraw.io/", False),
    ("Respeecher", "respeecher.com", "Voice & Music", "Ethical AI voice cloning built for film, game, and dubbing studios, with consent-based licensing per voice.", "Requires the original voice owner's explicit consent for every clone, built specifically to avoid deepfake misuse.", "https://www.respeecher.com/", False),

    # AI Phone Agents
    ("Bland AI", "bland.ai", "AI Phone Agents", "Programmable AI voice agents billed per minute, from $0.14/min.", "Has resolved hundreds of millions of real phone calls to date.", "reviews/bland-ai.html", True),
    ("Vapi", "vapi.ai", "AI Phone Agents", "A developer platform for building AI voice agents that can answer or make phone calls.", "Combines speech recognition, an AI model, and text-to-speech into one API, no stitching three services together.", "https://vapi.ai/", False),

    # 3D & Game Dev
    ("Meshy", "meshy.ai", "3D & Game Dev", "Generates 3D models from a text prompt or image, with auto-rigging and animation presets built in.", "Its texture generation can produce game-ready PBR materials that need little to no post-processing.", "https://www.meshy.ai/", False),
    ("Tripo AI", "tripo3d.ai", "3D & Game Dev", "Text or image-to-3D generation built for speed, exporting directly to game engine-friendly formats.", "Can produce a usable 3D model in as little as 8 seconds, with bridges into Blender, Unity, and Unreal.", "https://www.tripo3d.ai/", False),

    # Coding & Dev Tools
    ("Cursor", "cursor.com", "Coding & Dev Tools", "AI-native code editor for solopreneurs building their own product.", "It's a fork of VS Code, so most existing extensions and workflows carry over.", "reviews/cursor.html", True),
    ("GitHub Copilot", "github.com", "Coding & Dev Tools", "GitHub's AI pair programmer, built directly into your code editor.", "One of the earliest mainstream AI coding tools, it helped popularize AI-assisted programming as a category.", "https://github.com/features/copilot", False),
    ("Windsurf", "windsurf.com", "Coding & Dev Tools", "An AI-powered code editor whose Cascade agent handles multi-step coding tasks while you stay in the loop.", "Now owned by Cognition, the same company behind the autonomous coding agent Devin.", "https://windsurf.com/", False),
    ("Devin", "devin.ai", "Coding & Dev Tools", "An autonomous AI software engineer that plans, writes, tests, and submits code changes on its own.", "Hand it a task like 'fix this GitHub issue' and it executes the fix inside its own cloud sandbox, unsupervised.", "https://devin.ai/", False),
    ("Replit Agent", "replit.com", "Coding & Dev Tools", "A browser-based AI agent that builds, runs, and deploys full-stack apps inside Replit's IDE.", "Handles the whole stack, servers, databases, and publishing, without anything installed locally.", "https://replit.com/", False),
    ("v0", "v0.dev", "Coding & Dev Tools", "Vercel's AI tool that generates real, working frontend UI code from a prompt or screenshot, free or from $30/user/month.", "Generated components deploy straight to Vercel's hosting with zero extra setup.", "reviews/vercel-v0.html", True),
    ("Bolt.new", "bolt.new", "Coding & Dev Tools", "A browser-based AI app builder built for fast, full-stack prototyping with no local setup.", "Its daily token allowance resets every 24 hours, keeping it usable for ongoing experimentation.", "https://bolt.new/", False),
    ("Lovable", "lovable.dev", "Coding & Dev Tools", "Describe an app in plain English and get a working frontend and backend, from $25/month.", "Lets you keep iterating conversationally, 'add a login page', instead of writing code yourself.", "reviews/lovable.html", True),
    ("Amazon Q Developer", "aws.amazon.com", "Coding & Dev Tools", "AWS's AI coding assistant, built specifically for writing and reasoning about cloud infrastructure code.", "Can trace a bug or cost spike back through your actual AWS account resources, not just your codebase.", "https://aws.amazon.com/q/developer/", False),
    ("Tabnine", "tabnine.com", "Coding & Dev Tools", "An AI code-completion tool that can run fully privately, on your own infrastructure or offline.", "One of the earliest AI coding tools on the market, it predates most of today's AI-native code editors.", "https://www.tabnine.com/", False),
    ("CodeRabbit", "coderabbit.ai", "Coding & Dev Tools", "An AI code review bot that leaves line-by-line comments on every pull request automatically.", "Learns a repo's own conventions over time instead of applying the same generic style rules to every project.", "https://www.coderabbit.ai/", False),
    ("Harness AI", "harness.io", "Coding & Dev Tools", "AI-assisted CI/CD platform that helps automate software delivery pipelines and flag deployment risk.", "Can automatically roll back a bad deployment the moment it detects an anomaly in production.", "https://www.harness.io/", False),
    ("Hugging Face", "huggingface.co", "Coding & Dev Tools", "The largest hub for open-source AI models, datasets, and demo spaces.", "Hosts well over a million public models and datasets, most of it free to download and run.", "https://huggingface.co/", False),
    ("LangChain", "langchain.com", "Coding & Dev Tools", "A framework for building LLM-powered apps and agents, chaining prompts, tools, and memory into one pipeline.", "Became such a default starting point for early AI agent projects that its name turned into shorthand for the whole category.", "https://www.langchain.com/", False),

    # Cybersecurity
    ("Wiz", "wiz.io", "Cybersecurity", "Agentless AI cloud security that scans an entire cloud environment without installing anything on individual machines.", "Can map a full cloud environment's risk exposure without ever installing an agent on a single server.", "https://www.wiz.io/", False),
    ("Astra Security", "getastra.com", "Cybersecurity", "AI-assisted vulnerability scanning and penetration testing built to be accessible for smaller teams.", "Combines automated scanning with real human pentesters reviewing the flagged results, not just an automated report.", "https://www.getastra.com/", False),

    # Writing & Copywriting
    ("Grammarly", "grammarly.com", "Writing & Copywriting", "Grammar, tone, and clarity checking everywhere you write.", "Checks writing inside almost any app on your device, not just its own editor.", "reviews/grammarly.html", True),
    ("Jasper", "jasper.ai", "Writing & Copywriting", "AI copywriting focused on brand-voice consistency for marketing teams.", "Its brand-voice training keeps tone consistent across a high volume of generated content.", "reviews/copyai-vs-jasper.html", True),
    ("Copy.ai", "copy.ai", "Writing & Copywriting", "AI copywriting with a real free tier and workflow automation beyond straight copywriting.", "Expanded past content generation into full go-to-market workflow automation.", "reviews/copyai-vs-jasper.html", True),
    ("Koala AI", "koala.sh", "Writing & Copywriting", "AI writer built for SEO-optimized articles, from $9/month.", "Runs real-time SERP analysis before drafting, structuring articles to actually compete for a keyword.", "reviews/koala-ai.html", True),
    ("Sudowrite", "sudowrite.com", "Writing & Copywriting", "An AI writing tool built specifically for fiction writers, novels, short stories, and worldbuilding.", "Its Story Bible feature tracks your characters and plot so the AI stays consistent across a long manuscript.", "https://sudowrite.com/", False),
    ("Writesonic", "writesonic.com", "Writing & Copywriting", "An AI writing tool aimed at marketing copy, blog posts, and SEO-optimized articles at scale.", "Bundles an AI chatbot, article writer, and image generator into one subscription.", "https://writesonic.com/", False),
    ("Rytr", "rytr.me", "Writing & Copywriting", "A budget AI writing assistant covering short-form marketing copy, emails, and social posts.", "Its free plan supports a genuinely usable monthly character allowance, not just a one-time trial.", "https://rytr.me/", False),
    ("NovelAI", "novelai.net", "Writing & Copywriting", "A subscription AI tool for fiction writing and anime-style image generation, built by a small studio called Anlatan.", "Bundles a fiction-tuned text model and an anime-trained image model in the same private workspace.", "https://novelai.net/", False),
    ("ProWritingAid", "prowritingaid.com", "Writing & Copywriting", "An AI-enhanced grammar and style editor built for long-form writing like novels and manuscripts, not just short-form copy.", "Runs dozens of specialized reports, pacing, dialogue tags, sentence-length variation, well beyond a basic grammar check.", "https://prowritingaid.com/", False),

    # Research & Knowledge
    ("NotebookLM", "notebooklm.google", "Research & Knowledge", "Google's source-grounded AI notebook; free tier covers 100 notebooks and 50 chats a day.", "Refuses to answer from general knowledge, every response is grounded in the documents you actually upload.", "reviews/notebooklm.html", True),
    ("Consensus", "consensus.app", "Research & Knowledge", "An AI search engine that answers questions using evidence from peer-reviewed research papers.", "Shows a visual 'Consensus Meter' indicating how much scientific agreement exists on a given question.", "https://consensus.app/", False),
    ("Elicit", "elicit.com", "Research & Knowledge", "An AI research assistant built for systematic literature reviews and evidence extraction.", "Can pull structured data out of hundreds of academic papers at once instead of you reading each one manually.", "https://elicit.com/", False),
    ("Anara", "anara.com", "Research & Knowledge", "An AI research assistant for reading, summarizing, and citing academic papers, with direct search across PubMed, arXiv, and JSTOR.", "Rebranded from Unriddle AI in 2025 and is now used by more than 3 million researchers, including people at Stanford, MIT, and Johns Hopkins.", "https://anara.com/", False),

    # Education & Tutoring
    ("Khanmigo", "khanacademy.org", "Education & Tutoring", "Khan Academy's AI tutor, free for teachers and low-cost for families, built to guide rather than give answers.", "Acts as a Socratic tutor across math, science, and test prep, prompting students toward the answer instead of stating it.", "https://www.khanacademy.org/khan-labs", False),
    ("MagicSchool AI", "magicschool.ai", "Education & Tutoring", "An AI toolkit built for teachers, covering lesson plans, rubrics, feedback, and classroom communication.", "Its free tier includes more usable tools than many competing paid education platforms.", "https://www.magicschool.ai/", False),
    ("Quizlet", "quizlet.com", "Education & Tutoring", "AI-assisted flashcards and study tools that generate practice questions from your own notes.", "Can turn a pasted set of class notes into a full practice test in seconds.", "https://quizlet.com/", False),

    # Translation & Localization
    ("DeepL", "deepl.com", "Translation & Localization", "AI translation widely regarded as the accuracy leader for European languages.", "Frequently outperforms larger general-purpose AI models on nuanced, idiomatic translation quality.", "https://www.deepl.com/", False),
    ("Lokalise", "lokalise.com", "Translation & Localization", "A localization management platform that uses AI to translate and manage product and app content at scale.", "Plugs directly into a product's codebase so new strings get flagged for translation automatically as they ship.", "https://lokalise.com/", False),

    # Accessibility
    ("AltText.ai", "alttext.ai", "Accessibility", "Generates descriptive alt text for images automatically, plugging into WordPress, Shopify, and other CMSs.", "Understands context well enough to describe a product photo differently than an editorial or decorative image.", "https://alttext.ai/", False),
    ("Rev", "rev.com", "Accessibility", "AI plus human-reviewed captions, transcripts, and subtitles built for accessibility compliance.", "Blends AI speed with human review, useful when captions need to be legally accurate, not just close enough.", "https://www.rev.com/", False),

    # AI Detection & Plagiarism
    ("GPTZero", "gptzero.me", "AI Detection & Plagiarism", "One of the first widely-used AI-text detectors, aimed at teachers and publishers checking for AI-written content.", "Was originally built by a Princeton student before growing into one of the most recognized names in AI detection.", "https://gptzero.me/", False),
    ("Originality.ai", "originality.ai", "AI Detection & Plagiarism", "Combines AI-content detection with traditional plagiarism checking in one tool aimed at publishers and agencies.", "Built specifically for content teams who need to verify a writer's submission wasn't AI-generated before paying for it.", "https://originality.ai/", False),
    ("QuillBot", "quillbot.com", "AI Detection & Plagiarism", "A paraphrasing and grammar tool that also includes a free AI detector and plagiarism checker.", "Started purely as a paraphrasing tool before expanding into detection as AI-written text became common to check for.", "https://quillbot.com/", False),

    # Project Management
    ("ClickUp Brain", "clickup.com", "Project Management", "AI layer on ClickUp's project management platform, sold as a paid add-on ($7-9/month) on top of a base plan.", "Best for solopreneurs already using ClickUp for task tracking, since per-seat AI pricing math favors a team of one.", "reviews/clickup-ai.html", True),

    # No-code / Database
    ("Airtable", "airtable.com", "No-code / Database", "A spreadsheet-database hybrid with AI credits for generating interfaces and automations from your own data.", "The free tier (1,000 records/base, 500 AI credits/editor) genuinely covers most solo use cases before you'd need to upgrade.", "reviews/airtable.html", True),
    ("AI2SQL", "ai2sql.io", "No-code / Database", "Turns plain-English requests into working SQL queries across 10+ database dialects.", "Connects to your actual database schema, so the generated queries reference real table and column names, not guesses.", "https://ai2sql.io/", False),
    ("Vanna AI", "vanna.ai", "No-code / Database", "An open-source framework for building your own text-to-SQL assistant on top of your database.", "Because it's open-source, developers can self-host it and fine-tune it on their own schema instead of using a black box.", "https://vanna.ai/", False),

    # SEO
    ("Semrush", "semrush.com", "SEO", "A comprehensive SEO research platform with AI-assisted content and keyword tools, from $139.95/month.", "Widely considered the most capable SEO tool in its category, though the price is overkill unless organic content is your core growth channel.", "reviews/semrush.html", True),
    ("Surfer SEO", "surferseo.com", "SEO", "AI content optimization that scores a draft against what's actually ranking on the live search results page.", "Rescans the live SERP each time, so its recommendations shift as competing pages change, not a static checklist.", "https://surferseo.com/", False),

    # Productivity & Notes
    ("Notion AI", "notion.com", "Productivity & Notes", "Notion's AI layer now requires the $20/user/month Business plan.", "Can build a tracker or database directly from a meeting summary you paste in.", "reviews/notion-ai.html", True),
    ("Reflect", "reflect.app", "Productivity & Notes", "A networked note-taking app with AI built in, designed around linking ideas together over time.", "Syncs in real time across every device with no manual save step.", "https://reflect.app/", False),
    ("Craft", "craft.do", "Productivity & Notes", "A visually polished notes and document app with AI writing assistance.", "Positioned as a more design-forward, visual alternative to Notion.", "reviews/craft.html", True),
    ("Tana", "tana.inc", "Productivity & Notes", "A node-based notes app where every piece of information is a structured object with its own properties.", "Its 'supertag' system applies consistent structure and AI auto-tagging across your whole knowledge base as you type.", "https://tana.inc/", False),
    ("Mem", "mem.ai", "Productivity & Notes", "An AI-first notes app that organizes and resurfaces what you've written without manual folders or tags.", "Lets you capture notes with no upfront structure, then automatically links and organizes them for you.", "https://get.mem.ai/", False),

    # Presentations & Design
    ("Gamma", "gamma.app", "Presentations & Design", "Turns a prompt into a formatted slide deck, document, or webpage.", "The same prompt can output a slide deck, a one-page doc, or a simple website.", "reviews/gamma.html", True),
    ("Beautiful.ai", "beautiful.ai", "Presentations & Design", "An AI-assisted slide deck tool where the layout automatically adjusts itself as you add content.", "Slides re-flow and resize automatically when edited, so it's hard to accidentally break the design.", "https://www.beautiful.ai/", False),
    ("Uizard", "uizard.io", "Presentations & Design", "An AI tool that turns rough sketches or text prompts into clickable app and website mockups.", "Can convert a photo of a hand-drawn wireframe into an editable digital design.", "https://uizard.io/", False),
    ("Looka", "looka.com", "Presentations & Design", "An AI logo and brand identity generator aimed at new small businesses.", "Generates a full brand kit, logo, colors, fonts, and social templates, from a single questionnaire.", "https://looka.com/", False),
    ("Plus AI", "plusai.com", "Presentations & Design", "An AI slide generator that works as an add-on directly inside Google Slides and PowerPoint.", "Builds and edits decks inside the presentation software you already use, instead of a separate app to export from.", "https://www.plusai.com/", False),

    # Design & Photography
    ("Canva Magic Studio", "canva.com", "Design & Photography", "AI design tools bundled into Canva Pro, from ~$10-15/month.", "The current #1-ranked tool on Solos Gems, across all 43 tools reviewed.", "reviews/canva-magic-studio.html", True),
    ("Photoroom", "photoroom.com", "Design & Photography", "AI background removal and product photo editing, from $7.50/month billed yearly.", "Purpose-built for e-commerce product photos rather than general design work.", "reviews/photoroom.html", True),

    # Meetings & Transcription
    ("Fireflies.ai", "fireflies.ai", "Meetings & Transcription", "Meeting transcription with unlimited minutes on every tier, including free.", "Unlimited transcription minutes even on its free plan, unusual for the category.", "reviews/fireflies-ai.html", True),
    ("Otter.ai", "otter.ai", "Meetings & Transcription", "Real-time meeting transcription and summaries; Business tier bills a 5-seat minimum.", "Can join a call automatically and start transcribing without anyone manually starting a recorder.", "reviews/otter-ai.html", True),
    ("Fathom", "fathom.video", "Meetings & Transcription", "A free AI meeting recorder that transcribes, summarizes, and highlights action items automatically.", "Its core recording and summarization features are free with no minutes cap.", "https://fathom.video/", False),
    ("Grain", "grain.com", "Meetings & Transcription", "AI meeting recording built around turning call moments into shareable video clips.", "Designed so sales and customer teams can clip a 30-second moment from a call instead of the whole recording.", "https://grain.com/", False),
    ("Loom", "loom.com", "Meetings & Transcription", "Async video messaging with AI transcripts and summaries; free tier caps videos at 5 minutes.", "Auto-generates a written summary and action items from any recorded video.", "reviews/loom.html", True),
    ("Granola", "granola.ai", "Meetings & Transcription", "An AI notetaker that runs locally on your Mac and never joins the call as a visible bot.", "Builds its notes from your own rough, typed scribbles during the meeting, not just a raw transcript.", "https://www.granola.ai/", False),
    ("Jamie", "meetjamie.ai", "Meetings & Transcription", "A bot-free AI notetaker that captures audio locally, in person or online, without a visible bot joining the call.", "Runs on European servers and is built GDPR-first, aimed at meetings where a visible recording bot isn't an option.", "https://www.meetjamie.ai/", False),

    # Email & Messaging
    ("Shortwave", "shortwave.com", "Email & Messaging", "AI email client that triages and summarizes your inbox; $18/seat/month for Pro.", "Lets you search your inbox in plain language instead of exact keyword matching.", "reviews/shortwave.html", True),

    # Marketing & Social Media
    ("Hootsuite", "hootsuite.com", "Marketing & Social Media", "Social media scheduling, listening, and analytics for teams managing multiple accounts across platforms.", "Its built-in OwlyWriter AI can draft new captions by learning from your own past best-performing posts.", "https://www.hootsuite.com/", False),
    ("Buffer", "buffer.com", "Marketing & Social Media", "Social media scheduling and analytics with a genuinely usable free tier for solo creators.", "Built from the start for individual creators and small teams rather than enterprise social war rooms.", "https://buffer.com/", False),
    ("StoryChief", "storychief.io", "Marketing & Social Media", "A content marketing platform that plans, writes, and distributes posts across blog, social, and email at once.", "Its AI writing assistant is connected to live SEO data, not just general-purpose chat.", "https://storychief.io/", False),

    # Automation & Workflow
    ("Zapier AI Actions", "zapier.com", "Automation & Workflow", "AI decision-making steps inside Zapier automations; new pricing model is easy to overspend on.", "Connects thousands of different apps together, the largest integration library in the category.", "reviews/zapier-ai.html", True),
    ("Make", "make.com", "Automation & Workflow", "Visual automation platform and a direct alternative to Zapier; credit-based pricing.", "Its canvas-style builder shows an entire automation, branches and all, on one screen.", "reviews/make.html", True),
    ("n8n", "n8n.io", "Automation & Workflow", "An open-source workflow automation platform that connects hundreds of apps together.", "Because it's open-source, you can self-host it for free instead of paying per task.", "https://n8n.io/", False),
    ("Lindy", "lindy.ai", "Automation & Workflow", "An AI executive assistant that triages your inbox, drafts replies in your voice, and coordinates scheduling, from $49.99/month after a 7-day trial.", "Can join and summarize your meetings, then update your CRM automatically, without you touching a keyboard.", "https://www.lindy.ai/", False),

    # Sales & Prospecting
    ("Apollo.io", "apollo.io", "Sales & Prospecting", "AI-assisted lead sourcing and outreach sequencing, from $49/user/month.", "Combines a large contact database and outreach automation in one platform.", "reviews/apollo-io.html", True),
    ("Clay", "clay.com", "Sales & Prospecting", "A data enrichment and prospecting platform that pulls from 150+ data providers into one workflow.", "Lets you chain dozens of different data sources and AI steps into a single custom prospecting pipeline.", "https://www.clay.com/", False),
    ("Instantly.ai", "instantly.ai", "Sales & Prospecting", "Cold email outreach and deliverability tooling with AI-assisted copywriting.", "Built specifically to manage inbox rotation and warmup so outreach at volume doesn't land in spam.", "https://instantly.ai/", False),

    # HR & Recruiting
    ("Juicebox", "juicebox.ai", "HR & Recruiting", "AI-powered candidate sourcing that lets recruiters search in plain language across hundreds of millions of profiles.", "Replaces manually-built Boolean search strings with a single natural-language sourcing query.", "https://juicebox.ai/", False),
    ("HireVue", "hirevue.com", "HR & Recruiting", "Structured, AI-assisted video interviewing built for enterprise hiring at volume.", "Uses science-backed assessment models to keep interview scoring consistent across hundreds of candidates.", "https://www.hirevue.com/", False),
    ("Recruiterflow", "recruiterflow.com", "HR & Recruiting", "A combined applicant tracking system and CRM built specifically for recruitment agencies.", "Bundles one of the largest suites of AI recruiting agents into a single platform, from sourcing to outreach.", "https://recruiterflow.com/", False),
    ("Paradox", "paradox.ai", "HR & Recruiting", "A conversational AI recruiting assistant (Olivia) that screens candidates and schedules interviews by text and chat.", "Handles high-volume hourly hiring for retail and healthcare chains, where speed to first contact matters most.", "https://www.paradox.ai/", False),

    # Legal
    ("Spellbook", "spellbook.com", "Legal", "AI contract drafting and review that runs natively inside Microsoft Word, aimed at small and mid-size law firms.", "Flags risky clauses and suggests redlines directly in the Word document a lawyer is already working in.", "https://www.spellbook.com/", False),
    ("Robin AI", "robinai.com", "Legal", "An AI contract review and negotiation assistant used by legal and business teams to speed up redlining.", "Can compare a contract against a company's own playbook and flag every clause that deviates from it.", "https://www.robinai.com/", False),
    ("Luminance", "luminance.com", "Legal", "AI built for bulk contract review and due diligence at enterprise scale.", "Can process thousands of contracts during a due-diligence review far faster than a team reading them manually.", "https://www.luminance.com/", False),
    ("DocuSign", "docusign.com", "Legal", "The most widely recognized e-signature platform, now with AI-powered contract analysis and workflow automation.", "Its Navigator feature reads and organizes every signed contract into a searchable repository automatically.", "https://www.docusign.com/", False),
    ("PandaDoc", "pandadoc.com", "Legal", "AI-assisted proposals, quotes, contracts, and e-signatures in one document workflow.", "Tracks exactly when a recipient opens and scrolls through a document, before they ever sign it.", "https://www.pandadoc.com/", False),
    ("Ironclad", "ironclad.com", "Legal", "A contract lifecycle management platform that uses AI to route, negotiate, and track agreements end to end.", "Can automatically flag which clauses in an incoming contract deviate from a company's pre-approved playbook.", "https://ironclad.com/", False),
    ("LegesGPT", "legesgpt.com", "Legal", "AI contract drafting, review, and citation checking aimed at solo lawyers and small firms, from $19.99/month.", "Checks citations and drafting conventions across 38+ jurisdictions, not just a single country's legal system.", "https://www.legesgpt.com/", False),

    # E-commerce
    ("Shopify Magic", "shopify.com", "E-commerce", "AI features built directly into Shopify: product descriptions, email content, and image editing.", "Included at no extra cost inside every Shopify plan, rather than sold as a separate add-on.", "https://www.shopify.com/magic", False),
    ("Klevu", "klevu.com", "E-commerce", "AI-powered on-site search and product discovery built for large product catalogs.", "Optimizes search results for actual revenue per query, not just keyword relevance.", "https://www.klevu.com/", False),

    # Career & Job Search
    ("Teal", "tealhq.com", "Career & Job Search", "An AI resume builder with a built-in job tracker for managing multiple applications at once.", "Its Job Matcher feature highlights exactly which skills and keywords a resume is missing for a specific job post.", "https://www.tealhq.com/", False),
    ("Jobscan", "jobscan.io", "Career & Job Search", "Tests a resume directly against the applicant tracking systems that will actually screen it.", "Checks resume match against named ATS platforms like Workday, Greenhouse, and iCIMS, not a generic score.", "https://www.jobscan.co/", False),
    ("Rezi", "rezi.ai", "Career & Job Search", "An ATS-safe AI resume builder aimed specifically at tech job seekers, sold as a lifetime plan.", "Built its formatting specifically to survive strict ATS parsing rather than to look good to a human first.", "https://www.rezi.ai/", False),

    # CRM & Client Management
    ("HubSpot Free CRM", "hubspot.com", "CRM & Client Management", "Free CRM tier is genuinely solid; AI features (Breeze) are rate-limited or paid.", "The free CRM tier has no user cap or expiration date, unusual among free CRM offers.", "reviews/hubspot-free-crm.html", True),
    ("Bonsai", "hellobonsai.com", "CRM & Client Management", "Contracts, invoicing, and scheduling for freelancers; Essentials tier is the sweet spot.", "Bundles contracts, invoicing, and scheduling into one dashboard built specifically for freelancers.", "reviews/bonsai.html", True),

    # Customer Support
    ("Chatbase", "chatbase.co", "Customer Support", "Custom AI chatbot trained on your own site or docs, from $32/month.", "Trains exclusively on your own content, so answers stay consistent with your actual policies.", "reviews/chatbase.html", True),
    ("Intercom Fin", "intercom.com", "Customer Support", "Intercom's AI agent that resolves customer support tickets autonomously, escalating to a human only when needed.", "Can resolve a large share of incoming support volume start to finish with no human agent involved.", "https://www.intercom.com/fin", False),
    ("Tidio", "tidio.com", "Customer Support", "AI chatbot and live chat aimed at small online stores that need support coverage without a support team.", "Built specifically for small e-commerce sellers rather than enterprise support desks.", "https://www.tidio.com/", False),
    ("eesel AI", "eesel.ai", "Customer Support", "Layers an AI support agent on top of a helpdesk you already use, Zendesk, Freshdesk, Gorgias, and 100+ others, billed per resolved ticket.", "Bills around $0.40 per resolved ticket instead of a flat monthly seat fee, so cost tracks actual support volume.", "https://www.eesel.ai/", False),

    # Data & Analytics
    ("Julius AI", "julius.ai", "Data & Analytics", "An AI data analyst that can analyze spreadsheets, build forecasts, and create charts from a plain-language request.", "Can train and run actual machine learning models from a conversational prompt, not just make charts.", "https://julius.ai/", False),
    ("Numerous.ai", "numerous.ai", "Data & Analytics", "AI formulas that live inside Google Sheets and Excel, from $8/month billed yearly.", "Lets you write a plain-language instruction as a spreadsheet formula instead of a nested function.", "reviews/numerous-ai.html", True),
    ("Rows", "rows.com", "Data & Analytics", "A spreadsheet built with AI formulas and live data connectors baked in from the start.", "Can pull live data directly from APIs and other apps into a cell, instead of a manual copy-paste import.", "https://rows.com/", False),
    ("Obviously AI", "obviously.ai", "Data & Analytics", "No-code predictive modeling, upload a spreadsheet and get a working machine learning prediction in minutes.", "Built specifically so a non-technical business user can train a real ML model without writing any code.", "https://www.obviously.ai/", False),

    # Personal Finance
    ("Copilot Money", "copilot.money", "Personal Finance", "AI-powered personal budgeting and net-worth tracking with automatic transaction categorization.", "Its AI learns your individual spending patterns over time instead of relying on generic category rules.", "https://copilot.money/", False),
    ("Monarch Money", "monarchmoney.com", "Personal Finance", "A budgeting and financial tracking app that gives a single clear view of spending, saving, and net worth.", "Built to give a full household financial picture in one dashboard, not just a single account view.", "https://www.monarchmoney.com/", False),
    ("Rocket Money", "rocketmoney.com", "Personal Finance", "Tracks spending, subscriptions, and net worth, and can negotiate bills or cancel subscriptions on your behalf.", "Will actually call and negotiate a lower bill for you, not just flag that a bill went up.", "https://www.rocketmoney.com/", False),
    ("Cleo", "meetcleo.com", "Personal Finance", "A conversational AI budgeting assistant built to make money management approachable, aimed at younger users.", "Delivers budgeting nudges through a chat interface with personality, rather than a traditional dashboard.", "https://www.meetcleo.com/", False),

    # Investing & Markets
    ("Seeking Alpha Premium", "seekingalpha.com", "Investing & Markets", "AI-assisted stock research that summarizes earnings, analyst ratings, and financial data into a single report per stock.", "Its Virtual Analyst Reports condense hours of financial-statement reading into one structured summary.", "https://seekingalpha.com/", False),
    ("Danelfin", "danelfin.com", "Investing & Markets", "An AI stock-rating platform that scores stocks on a 1-10 scale based on machine-learning models trained on historical data.", "Publishes the specific factors behind each score instead of a black-box rating with no explanation.", "https://danelfin.com/", False),

    # Scheduling & Time
    ("Calendly", "calendly.com", "Scheduling & Time", "Scheduling with AI-assisted call routing and no-show reduction.", "Can route a booking to the right team member automatically based on the meeting type.", "reviews/calendly.html", True),
    ("Motion", "usemotion.com", "Scheduling & Time", "AI calendar that auto-schedules your tasks around meetings; no free plan.", "Automatically re-shuffles your task schedule the moment a new meeting gets booked.", "reviews/motion.html", True),
    ("Toggl Track", "toggl.com", "Scheduling & Time", "Time tracking with AI-assisted categorization; free for up to 5 users.", "Free plan supports up to 5 users at no cost, unusually generous for a time tracker.", "reviews/toggl-track.html", True),
    ("Reclaim.ai", "reclaim.ai", "Scheduling & Time", "An AI calendar tool that auto-schedules habits, focus time, and tasks around your existing meetings.", "Automatically defends time for recurring habits like exercise or deep work, rescheduling them if a meeting collides.", "https://reclaim.ai/", False),

    # Health & Fitness
    ("Fitbod", "fitbod.me", "Health & Fitness", "AI-personalized strength training plans that adapt each workout based on what you did last time.", "Adjusts the next workout's exercises and volume based on your recovery and performance in the last session.", "https://www.fitbod.me/", False),
    ("Whoop", "whoop.com", "Health & Fitness", "A wearable that tracks recovery, sleep, and strain, with AI-driven coaching insights.", "Gives a daily recovery score that adjusts recommended training intensity based on how well you actually slept.", "https://www.whoop.com/", False),
    ("MyFitnessPal", "myfitnesspal.com", "Health & Fitness", "AI-assisted food logging and calorie tracking, including logging a meal from a photo.", "Can estimate a full meal's nutrition breakdown from a single photo instead of manual entry.", "https://www.myfitnesspal.com/", False),
    ("Calm", "calm.com", "Health & Fitness", "A meditation and sleep app with AI-personalized content recommendations.", "Tailors its daily meditation and sleep content suggestions to your own usage patterns over time.", "https://www.calm.com/", False),
    ("Noom", "noom.com", "Health & Fitness", "An AI-assisted behavior-change program aimed at weight loss through psychology-based coaching, not just calorie counts.", "Built around cognitive-behavioral psychology, focused on why people eat, not just what they eat.", "https://www.noom.com/", False),

    # Real Estate
    ("Epique AI", "epique.ai", "Real Estate", "An AI platform built specifically for real estate agents: listing descriptions, client emails, and social posts.", "Generates MLS-ready listing copy alongside the buyer and seller emails an agent needs for the same transaction.", "https://www.epique.ai/", False),
    ("Virtual Staging AI", "virtualstagingai.app", "Real Estate", "Digitally furnishes an empty listing photo with AI-generated furniture instead of hiring a staging company.", "Turns an empty room photo into a fully furnished one in under a minute, at a fraction of physical staging cost.", "https://www.virtualstagingai.app/", False),

    # Interior Design
    ("RemodelAI", "remodelai.io", "Interior Design", "Photorealistic room redesigns from a single photo, plus exterior, virtual staging, and paint-color tools.", "Offers 30+ distinct design styles and lets you try several before committing to a real renovation.", "https://www.remodelai.io/", False),
    ("Interior AI", "interiorai.com", "Interior Design", "Generates fully styled interior spaces from a room photo or a plain-language description.", "Can also auto-generate a matching mood board alongside the redesigned room, not just a single image.", "https://interiorai.com/", False),

    # Bookkeeping & Finance
    ("QuickBooks Solopreneur", "quickbooks.intuit.com", "Bookkeeping & Finance", "Bookkeeping built for one-person Schedule-C businesses, not a scaled-down QuickBooks Online.", "Built from scratch specifically for one-person businesses, not just a trimmed-down version of the full product.", "reviews/quickbooks-solopreneur.html", True),
    ("Lettuce", "lettuce.co", "Bookkeeping & Finance", "Bookkeeping, payroll, taxes, and AI-powered financial insights bundled specifically for S-corp solopreneurs.", "Built around the specific tax mechanics of a one-person S-corp, a structure most general bookkeeping tools treat as an afterthought.", "https://www.lettuce.co/", False),
    ("Cashflowy", "cashflowy.ai", "Bookkeeping & Finance", "AI bookkeeping for solopreneurs and service-based freelancers, pairing an AI coach that reads your actual books with a human bookkeeper.", "Includes a trained human bookkeeper at no extra charge on top of the AI layer, instead of AI as the only line of support.", "https://www.cashflowy.ai/", False),

    # Website & App Builders
    ("Framer", "framer.com", "Website & App Builders", "AI-assisted website builder; generate and publish a real site from a prompt, then edit visually.", "The free plan is genuinely usable to launch a real, live site, not a crippled demo.", "reviews/framer.html", True),
    ("Durable", "durable.co", "Website & App Builders", "Generates a full small-business website, copy, images, and booking, in under a minute.", "Also auto-generates basic business tools like invoices and a CRM alongside the website itself.", "reviews/durable.html", True),
    ("10Web", "10web.io", "Website & App Builders", "AI WordPress website builder and managed hosting bundled into one platform.", "Can rebuild an existing website's layout and content automatically just from its URL.", "https://10web.io/", False),
    ("Wix", "wix.com", "Website & App Builders", "A website builder with an AI chat-based setup wizard that generates a starting site from a short conversation.", "Its AI assistant asks about your business first, then generates a tailored starting site instead of a generic template.", "https://www.wix.com/", False),
    ("Webflow", "webflow.com", "Website & App Builders", "A visual website builder with AI site-generation features, producing clean, exportable code under the hood.", "Generates real, semantic HTML and CSS you can inspect and export, not a proprietary black-box format.", "https://webflow.com/", False),

    # Forms & Surveys
    ("Typeform", "typeform.com", "Forms & Surveys", "Conversational forms and surveys with AI-assisted question generation, from $28/month.", "Presents one question at a time in a full-screen format, which measurably raises completion rates.", "reviews/typeform.html", True),
    ("Chattermill", "chattermill.com", "Forms & Surveys", "AI feedback analytics that ties customer survey responses to NPS, CSAT, and revenue outcomes.", "Reads open-text feedback across every channel at once, support tickets, reviews, surveys, in one unified view.", "https://chattermill.com/", False),
    ("Dovetail", "dovetail.com", "Forms & Surveys", "An AI-assisted research repository that organizes interviews, surveys, and notes into searchable themes.", "Can surface a recurring theme across dozens of past user interviews in seconds instead of a manual re-read.", "https://dovetail.com/", False),

    # Podcasting & Video Editing
    ("Riverside.fm", "riverside.fm", "Podcasting & Video Editing", "Studio-quality remote podcast and video recording with local-device recording.", "Records each guest locally at full quality, so a bad internet connection doesn't degrade the final file.", "reviews/riverside.html", True),
    ("Descript", "descript.com", "Podcasting & Video Editing", "Edit audio/video by editing a text transcript.", "Deleting a word from the transcript deletes it from the actual audio and video too.", "reviews/descript.html", True),
    ("Auphonic", "auphonic.com", "Podcasting & Video Editing", "AI audio post-production that automatically levels, cleans up noise, and masters podcast episodes.", "Normalizes multiple speakers recorded at different volumes into one consistent, broadcast-ready level automatically.", "https://auphonic.com/", False),
    ("Cleanvoice", "cleanvoice.ai", "Podcasting & Video Editing", "Automated podcast audio cleanup that strips filler words, breaths, stutters, and long pauses from a raw recording.", "Its filler-word detection works across multiple languages, not just English, and can shorten long dead-air pauses automatically.", "https://cleanvoice.ai/", False),

    # Newsletters
    ("Beehiiv", "beehiiv.com", "Newsletters", "Newsletter platform built for monetization from day one; 0% commission on paid subscriptions.", "Takes 0% commission on paid subscriptions, unlike most newsletter platforms.", "reviews/beehiiv.html", True),

    # Local Business
    ("Podium", "podium.com", "Local Business", "AI-assisted text messaging, review requests, and lead follow-up built for local service businesses.", "Built specifically to move phone and walk-in leads into text conversations, where response rates run far higher.", "https://www.podium.com/", False),

    # Voice Dictation
    ("Wispr Flow", "wisprflow.ai", "Voice Dictation", "AI voice dictation that writes in your own tone across any app on your computer, free or $12/user/month.", "Works system-wide, not just inside one app, so it dictates into email, Slack, or a code editor alike.", "reviews/wispr-flow.html", True),
    ("Superwhisper", "superwhisper.com", "Voice Dictation", "AI voice dictation for Mac and iOS that types in any app, running on local AI models, free or $8.49/month for cloud models and file transcription.", "Runs entirely on-device using local AI models, so the free tier works offline with no word cap and no account required.", "https://superwhisper.com/", False),
    ("Willow Voice", "willowvoice.com", "Voice Dictation", "Cross-platform AI dictation for Mac, Windows, and iOS with style memory that learns how you write, from a free tier of 2,000 words a week up to $15/month for unlimited use.", "Its iPhone keyboard now ships with free, unlimited AI dictation built in, a rare case of a paid tool's core feature going free on mobile.", "https://willowvoice.com/", False),

    # CRM & Client Management
    ("Attio", "attio.com", "CRM & Client Management", "A flexible, data-first CRM with AI features built into every plan, including a free tier for up to 3 users, or $29/seat/month for Plus.", "Unlike most CRMs that gate AI behind the priciest tier, Attio includes AI research and enrichment on its free plan too, just with lower usage limits.", "https://attio.com/", False),

    # SEO
    ("Ahrefs", "ahrefs.com", "SEO", "A comprehensive SEO platform with AI content grading and search-intent tools, from $29/month for the Starter plan. No free plan, only a trial.", "Its backlink index is large enough that competitors routinely cite Ahrefs' own crawl data as an industry benchmark for link data freshness.", "https://ahrefs.com/", False),

    # Investing & Markets
    ("Composer", "composer.trade", "Investing & Markets", "AI-assisted, no-code trading strategy builder that backtests stock and ETF strategies, with a free tier for building and backtesting, or $32/month for live automated execution.", "You describe a trading idea in plain language or a visual editor, and it turns that into a fully automated, rebalancing strategy without writing a line of code.", "https://www.composer.trade/", False),

    # Local Business
    ("Birdeye", "birdeye.com", "Local Business", "AI-powered reputation management for local businesses, automating review requests, monitoring, and responses. No free plan, starting around $299 per location per month.", "Its pricing structure charges the full plan rate per physical location, which makes it a serious expense fast for any business with more than one storefront.", "https://birdeye.com/", False),

    # Marketing & Social Media
    ("Ocoya", "ocoya.com", "Marketing & Social Media", "AI social media scheduling and caption generation across 30+ platforms, with a free tier to start and paid plans from $19/month.", "It bundles AI copywriting directly into the scheduling calendar, so captions, hashtags, and post variations get generated on the same screen where you queue the post.", "https://www.ocoya.com/", False),

    # Interior Design
    ("MyArchitectAI", "myarchitectai.com", "Interior Design", "Generates interior and exterior design renders from a photo or sketch, with a free tier covering 10 renders and 10 edits before $29/month plans kick in.", "It renders both interior room redesigns and full exterior architectural concepts from the same tool, most competitors only do one or the other.", "https://myarchitectai.com/", False),
]

CATEGORY_ORDER = [
    "AI Assistants", "AI Search & Browsing", "Image Generation", "Video Generation", "Voice & Music", "AI Phone Agents",
    "3D & Game Dev", "Coding & Dev Tools", "Cybersecurity", "Writing & Copywriting", "Research & Knowledge",
    "Education & Tutoring", "Translation & Localization", "Accessibility", "AI Detection & Plagiarism", "Project Management",
    "No-code / Database", "Productivity & Notes",
    "Presentations & Design", "Design & Photography", "Meetings & Transcription", "Email & Messaging",
    "Marketing & Social Media", "Automation & Workflow", "Sales & Prospecting", "HR & Recruiting", "Legal",
    "E-commerce", "Career & Job Search", "CRM & Client Management", "Customer Support",
    "Data & Analytics", "Personal Finance", "Investing & Markets", "SEO", "Scheduling & Time", "Health & Fitness", "Real Estate",
    "Interior Design", "Bookkeeping & Finance", "Website & App Builders",
    "Forms & Surveys", "Podcasting & Video Editing", "Newsletters", "Local Business", "Voice Dictation",
]

CATEGORY_ICON = {
    "AI Assistants": "\U0001F916", "AI Search & Browsing": "\U0001F50E", "Image Generation": "\U0001F3A8",
    "Video Generation": "\U0001F3AC", "Voice & Music": "\U0001F399️", "AI Phone Agents": "☎️",
    "3D & Game Dev": "\U0001F579️", "Coding & Dev Tools": "\U0001F4BB", "Cybersecurity": "\U0001F6E1️",
    "Writing & Copywriting": "✍️", "Research & Knowledge": "\U0001F4DA", "Education & Tutoring": "\U0001F393",
    "Translation & Localization": "\U0001F310", "Accessibility": "♿", "AI Detection & Plagiarism": "\U0001F575️",
    "Project Management": "\U0001F5C2️", "No-code / Database": "\U0001F5C4️", "Productivity & Notes": "\U0001F5D2️",
    "Presentations & Design": "\U0001F4CA", "Design & Photography": "\U0001F4F7", "Meetings & Transcription": "\U0001F3A4",
    "Email & Messaging": "\U0001F4E7", "Marketing & Social Media": "\U0001F4E3", "Automation & Workflow": "⚙️",
    "Sales & Prospecting": "\U0001F3AF", "HR & Recruiting": "\U0001F9D1‍\U0001F4BC", "Legal": "⚖️",
    "E-commerce": "\U0001F6D2", "Career & Job Search": "\U0001F4BC", "CRM & Client Management": "\U0001F91D",
    "Customer Support": "\U0001F3A7", "Data & Analytics": "\U0001F4C8", "Personal Finance": "\U0001F4B0",
    "Investing & Markets": "\U0001F4C9", "SEO": "\U0001F50D", "Scheduling & Time": "\U0001F5D3️",
    "Health & Fitness": "\U0001F4AA", "Real Estate": "\U0001F3E0", "Interior Design": "\U0001F6CB️",
    "Bookkeeping & Finance": "\U0001F9FE", "Website & App Builders": "\U0001F9F1", "Forms & Surveys": "\U0001F4CB",
    "Podcasting & Video Editing": "\U0001F39B️", "Newsletters": "\U0001F4F0", "Local Business": "\U0001F3EA",
    "Voice Dictation": "\U0001F5E3️",
}
CATEGORY_ACCENTS = ["#e0692a", "#4fa3c7", "#6fae6a", "#c9a53b", "#a878c9", "#d97a9c", "#5fb8a8", "#cc8b4a"]
def category_accent(cat):
    idx = CATEGORY_ORDER.index(cat) if cat in CATEGORY_ORDER else 0
    return CATEGORY_ACCENTS[idx % len(CATEGORY_ACCENTS)]
def cat_icon(cat):
    return CATEGORY_ICON.get(cat, "✨")

by_cat = {}
for t in TOOLS:
    by_cat.setdefault(t[2], []).append(t)

print(f"Total tools: {len(TOOLS)}")
for c in CATEGORY_ORDER:
    print(f"  {c}: {len(by_cat.get(c, []))}")
missing_cats = set(by_cat.keys()) - set(CATEGORY_ORDER)
assert not missing_cats, f"categories not in order list: {missing_cats}"

# ---------------- Build HTML ----------------
def row(name, domain, cat, desc, cool_fact, link, internal):
    href = link  # already root-relative for internal ("reviews/x.html") or absolute external
    target = "" if internal else ' target="_blank" rel="noopener"'
    tier = price_bucket(desc, cool_fact)
    accent = category_accent(cat)
    return f'''      <a class="db-row" href="{href}"{target} data-name="{name.lower()}" data-category="{cat}" data-tier="{tier}" style="--cat-accent:{accent}">
        <img class="db-logo" src="{fav(domain)}" alt="{name} logo" width="36" height="36" loading="lazy">
        <div class="db-row-body">
          <h3>{name}</h3>
          <p>{desc}</p>
          <p class="db-cool"><strong>Cool fact:</strong> {cool_fact}</p>
        </div>
      </a>'''

def escape_attr(s):
    return (s.replace("&", "&amp;").replace('"', "&quot;")
             .replace("<", "&lt;").replace(">", "&gt;"))

def price_bucket(desc, cool_fact):
    raw = free_tier(desc, cool_fact)
    return "free" if raw in ("free", "freemium") else raw  # "paid" or "unlisted"

def wall_item(name, domain, cat, desc, cool_fact, link, internal):
    href = link
    target = "" if internal else ' target="_blank" rel="noopener"'
    tier = price_bucket(desc, cool_fact)
    added = date_added(name)
    is_new = "1" if added == TODAY else "0"
    new_badge = '<span class="db-wall-new">NEW</span>' if is_new == "1" else ""
    accent = category_accent(cat)
    return (f'<a class="db-wall-item" href="{href}"{target} data-name="{name.lower()}" data-category="{cat}" '
            f'data-tier="{tier}" data-date="{added}" data-new="{is_new}" style="--cat-accent:{accent}" '
            f'data-desc="{escape_attr(desc)}" data-fact="{escape_attr(cool_fact)}" title="{name}">'
            f'<img class="db-wall-logo" src="{fav(domain)}" alt="{name} logo" width="28" height="28" loading="lazy">'
            f'{new_badge}</a>')

wall_items_sorted = sorted(TOOLS, key=lambda t: t[0].lower())
wall_html = "\n      ".join(
    wall_item(name, domain, cat, desc, cool_fact, link, internal)
    for name, domain, cat, desc, cool_fact, link, internal in wall_items_sorted
)

wall_categories_present = [c for c in CATEGORY_ORDER if by_cat.get(c)]
wall_filter_options = "\n          ".join(
    f'<option value="{c}">{cat_icon(c)} {c} ({len(by_cat[c])})</option>' for c in wall_categories_present
)

_tier_counts = {"free": 0, "paid": 0, "unlisted": 0}
for _n, _d, _c, _desc, _fact, _l, _i in TOOLS:
    _tier_counts[price_bucket(_desc, _fact)] += 1
wall_tier_options = (
    f'<option value="free">Free tier available ({_tier_counts["free"]})</option>\n'
    f'          <option value="paid">Paid only ({_tier_counts["paid"]})</option>\n'
    f'          <option value="unlisted">Pricing not listed ({_tier_counts["unlisted"]})</option>'
)
_new_count = sum(1 for t in TOOLS if date_added(t[0]) == TODAY)

sections = []
nav_links = []
for c in CATEGORY_ORDER:
    items = by_cat.get(c, [])
    if not items:
        continue
    anchor = c.lower().replace(" & ", "-").replace(" / ", "-").replace(" ", "-").replace("/", "-")
    icon = cat_icon(c)
    accent = category_accent(c)
    nav_links.append(f'<a href="#{anchor}" style="--cat-accent:{accent}"><span class="db-nav-name">{icon} {c}</span><span class="db-nav-count">{len(items)}</span></a>')
    rows_html = "\n".join(row(name, domain, cat, desc, cool_fact, link, internal) for name, domain, cat, desc, cool_fact, link, internal in items)
    sections.append(f'''
  <section class="db-section" id="{anchor}" data-category="{c}">
    <h2 style="--cat-accent:{accent}">{icon} {c} <span class="db-count">({len(items)})</span></h2>
    <div class="db-list">
{rows_html}
    </div>
  </section>''')

sections_html = "\n".join(sections)
nav_html = "\n      ".join(nav_links)

TOP_RANKED = [
    ("Canva Magic Studio", "canva-magic-studio", 1),
    ("NotebookLM", "notebooklm", 2),
    ("Fireflies.ai", "fireflies-ai", 3),
    ("Beehiiv", "beehiiv", 4),
    ("Grammarly", "grammarly", 5),
    ("Otter.ai", "otter-ai", 6),
    ("Photoroom", "photoroom", 7),
    ("Descript", "descript", 8),
    ("Koala AI", "koala-ai", 9),
    ("Airtable", "airtable", 10),
]
def _rank_li(name, slug, rank):
    cls = ' class="top"' if rank == 1 else ""
    return f'<li{cls}><a href="reviews/{slug}.html"><span class="rank-list-num">{rank}</span>{name}</a></li>'

rank_items = "\n      ".join(_rank_li(name, slug, rank) for name, slug, rank in TOP_RANKED)

PAGE = f'''<!DOCTYPE html>
<html lang="en">
<head>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1475310308913553"
     crossorigin="anonymous"></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="max-image-preview:large">
<title>Solos Gems: The AI Tools Database for Solopreneurs</title>
<meta name="description" content="A categorized directory of {len(TOOLS)}+ AI tools, plus 45 fully tested, priced, and ranked reviews for solopreneurs. Chatbots, image and video generation, coding, writing, automation, and more.">
<link rel="canonical" href="https://solosgems.com/">
<link rel="icon" type="image/svg+xml" href="favicon.svg">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Solos Gems">
<meta property="og:title" content="Solos Gems: The AI Tools Database for Solopreneurs">
<meta property="og:description" content="A categorized directory of {len(TOOLS)}+ AI tools, plus 45 fully tested, priced, and ranked reviews for solopreneurs.">
<meta property="og:url" content="https://solosgems.com/">
<meta property="og:image" content="https://solosgems.com/images/og-default.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="Solos Gems: The AI Tools Database for Solopreneurs">
<meta name="twitter:description" content="A categorized directory of {len(TOOLS)}+ AI tools, plus 45 fully tested, priced, and ranked reviews for solopreneurs.">
<meta name="twitter:image" content="https://solosgems.com/images/og-default.png">
<meta name="theme-color" content="#1a1a18">
<link rel="stylesheet" href="styles.css">
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Solos Gems",
  "url": "https://solosgems.com/",
  "description": "A categorized directory of {len(TOOLS)}+ AI tools, plus 45 fully tested, priced, and ranked reviews for solopreneurs.",
  "publisher": {{
    "@type": "Organization",
    "name": "Solos Gems",
    "url": "https://solosgems.com/",
    "logo": {{ "@type": "ImageObject", "url": "https://solosgems.com/images/og-default.png" }}
  }}
}}
</script>
<script type="application/ld+json">
{{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "The AI Tools Database",
  "description": "A categorized directory of {len(TOOLS)}+ AI tools across every major category.",
  "url": "https://solosgems.com/",
  "isPartOf": {{ "@type": "WebSite", "name": "Solos Gems", "url": "https://solosgems.com/" }}
}}
</script>
</head>
<body>

<header class="site-header">
  <div class="wrap">
    <a class="logo" href="index.html"><svg class="gem-icon" viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
        <defs>
          <linearGradient id="gemGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffd76a"/>
            <stop offset="100%" stop-color="#b8790f"/>
          </linearGradient>
        </defs>
        <polygon points="16,2 27,12 16,30 5,12" fill="url(#gemGrad)" stroke="#1a1a18" stroke-width="1"/>
        <polygon points="16,2 27,12 21,12" fill="#fff3cf"/>
        <polygon points="16,2 5,12 11,12" fill="#ffe9a8"/>
        <polygon points="5,12 11,12 16,30" fill="#c98a1f"/>
        <polygon points="27,12 21,12 16,30" fill="#8a5a12"/>
        <line x1="11" y1="12" x2="21" y2="12" stroke="#1a1a18" stroke-width="0.6"/>
      </svg><span class="logo-word">SOLOS GEMS</span></a>
    <nav>
      <a href="reviews.html">Reviews</a>
      <a href="deathstack.html">DeathStack</a>
      <a href="news.html">News</a>
      <a href="submit.html">Submit</a>
      <a href="about.html">About</a>
    </nav>
  </div>
</header>

<main class="wide">
  <section class="hero">
    <span class="kicker">The Full Schematic</span>
    <h1>The AI Tools Database</h1>
  </section>

  <a class="db-banner" href="reviews.html">
    <div class="db-banner-text">
      <span class="db-banner-kicker">Tested. Ranked. Occasionally roasted.</span>
    </div>
    <span class="db-banner-cta">See the rankings &rarr;</span>
  </a>

  <div class="news-ticker" aria-label="Latest AI news, scrolling">
    <a class="news-ticker-label" href="news.html">News</a>
    <div class="news-ticker-viewport">
      <div class="news-ticker-track" id="news-ticker-track">
        <span class="news-ticker-item">Loading the latest AI headlines...</span>
      </div>
    </div>
  </div>
  <script>
  (function () {{
    var track = document.getElementById('news-ticker-track');
    if (!track) return;

    function buildItem(it) {{
      var a = document.createElement('a');
      a.className = 'news-ticker-item';
      a.href = it.link;
      a.target = '_blank';
      a.rel = 'noopener';
      if (it.controversial) {{
        var dot = document.createElement('span');
        dot.className = 'news-ticker-hot';
        dot.textContent = '● ';
        a.appendChild(dot);
      }}
      var src = document.createElement('span');
      src.className = 'news-ticker-source';
      src.textContent = it.source;
      a.appendChild(src);
      var title = document.createElement('span');
      title.textContent = it.title;
      a.appendChild(title);
      return a;
    }}

    fetch('/api/news')
      .then(function (res) {{ return res.json(); }})
      .then(function (data) {{
        var items = (data.items || []).slice(0, 15);
        track.innerHTML = '';
        if (!items.length) {{
          var span = document.createElement('span');
          span.className = 'news-ticker-item';
          span.textContent = 'No headlines yet, check back soon.';
          track.appendChild(span);
          return;
        }}
        items.concat(items).forEach(function (it) {{
          track.appendChild(buildItem(it));
        }});
        var duration = Math.max(20, items.length * 6);
        track.style.animationDuration = duration + 's';
      }})
      .catch(function () {{
        track.innerHTML = '';
        var span = document.createElement('span');
        span.className = 'news-ticker-item';
        span.textContent = "Couldn't load headlines right now.";
        track.appendChild(span);
      }});
  }})();
  </script>

  <section class="db-wall">
    <div class="db-wall-head">
      <h2>Every tool. One glance.</h2>
      <p>{len(TOOLS)} logos, zero scrolling required. Hover for a preview, click to go, or search and filter for what you need.{f' <span class="db-wall-new-flag">{_new_count} added this week.</span>' if _new_count else ''}</p>
    </div>
    <div class="db-wall-filters">
      <input type="text" id="db-wall-search" class="db-wall-search" placeholder="Search {len(TOOLS)} tools by name..." aria-label="Search tools by name">
      <select id="db-wall-category" class="db-wall-select" aria-label="Filter by category">
        <option value="">All categories ({len(TOOLS)})</option>
        {wall_filter_options}
      </select>
      <select id="db-wall-tier" class="db-wall-select" aria-label="Filter by pricing">
        <option value="">Any pricing ({len(TOOLS)})</option>
        {wall_tier_options}
      </select>
      <select id="db-wall-sort" class="db-wall-select" aria-label="Sort tools">
        <option value="name">Sort: A to Z</option>
        <option value="newest">Sort: Newest added</option>
        <option value="category">Sort: Category</option>
      </select>
      <span id="db-wall-count" class="db-wall-count">Showing all {len(TOOLS)}</span>
    </div>
    <div class="db-wall-grid" id="db-wall-grid">
      {wall_html}
    </div>
    <p id="db-wall-empty" class="db-wall-empty" hidden>No tools match that search. Try a different name, category, or pricing filter, or <a href="submit.html">submit one we're missing</a>.</p>
    <p class="db-wall-data-links">Want the raw data? <a href="data/tools.json">JSON</a> &middot; <a href="data/tools.csv" download>CSV</a> &middot; updated whenever this page is.</p>
  </section>

  <div class="db-wall-popover" id="db-wall-popover" hidden role="tooltip">
    <p class="db-wall-popover-name" id="db-wall-popover-name"></p>
    <p class="db-wall-popover-desc" id="db-wall-popover-desc"></p>
    <p class="db-wall-popover-fact" id="db-wall-popover-fact"></p>
  </div>

  <div class="db-layout">
    <aside class="db-sidebar">
      <div class="db-sidebar-block">
        <h3>Reviewed Rankings</h3>
        <ol class="rank-list">
      {rank_items}
        </ol>
        <a class="db-sidebar-more" href="reviews.html">See full rankings &rarr;</a>
      </div>
      <div class="db-sidebar-block">
        <h3>Categories</h3>
        <nav class="db-nav" aria-label="Jump to category">
          {nav_html}
        </nav>
      </div>
    </aside>
    <div class="db-main" id="db-main">
{sections_html}
      <p id="db-list-empty" class="db-wall-empty" hidden>No tools in this view match your filters. <a href="#" id="db-list-clear">Clear filters</a> to see the full list.</p>
    </div>
  </div>

  <script>
  (function() {{
    var search = document.getElementById('db-wall-search');
    var category = document.getElementById('db-wall-category');
    var tierSelect = document.getElementById('db-wall-tier');
    var sortSelect = document.getElementById('db-wall-sort');
    var grid = document.getElementById('db-wall-grid');
    var items = Array.prototype.slice.call(grid.querySelectorAll('.db-wall-item'));
    var count = document.getElementById('db-wall-count');
    var empty = document.getElementById('db-wall-empty');
    var total = items.length;
    var popover = document.getElementById('db-wall-popover');
    var popName = document.getElementById('db-wall-popover-name');
    var popDesc = document.getElementById('db-wall-popover-desc');
    var popFact = document.getElementById('db-wall-popover-fact');
    var listRows = Array.prototype.slice.call(document.querySelectorAll('.db-main .db-row'));
    var listSections = Array.prototype.slice.call(document.querySelectorAll('.db-main .db-section'));
    var listEmpty = document.getElementById('db-list-empty');
    var listClear = document.getElementById('db-list-clear');

    function paramsFromUrl() {{
      var p = new URLSearchParams(window.location.search);
      return {{ q: p.get('q') || '', cat: p.get('cat') || '', tier: p.get('tier') || '', sort: p.get('sort') || 'name' }};
    }}

    function syncUrl() {{
      var p = new URLSearchParams();
      if (search.value.trim()) p.set('q', search.value.trim());
      if (category.value) p.set('cat', category.value);
      if (tierSelect.value) p.set('tier', tierSelect.value);
      if (sortSelect.value !== 'name') p.set('sort', sortSelect.value);
      var qs = p.toString();
      var newUrl = window.location.pathname + (qs ? '?' + qs : '');
      window.history.replaceState(null, '', newUrl);
    }}

    function applySort() {{
      var mode = sortSelect.value;
      var sorted = items.slice();
      if (mode === 'newest') {{
        sorted.sort(function(a, b) {{
          if (a.dataset.date !== b.dataset.date) return a.dataset.date < b.dataset.date ? 1 : -1;
          return a.dataset.name.localeCompare(b.dataset.name);
        }});
      }} else if (mode === 'category') {{
        sorted.sort(function(a, b) {{
          if (a.dataset.category !== b.dataset.category) return a.dataset.category.localeCompare(b.dataset.category);
          return a.dataset.name.localeCompare(b.dataset.name);
        }});
      }} else {{
        sorted.sort(function(a, b) {{ return a.dataset.name.localeCompare(b.dataset.name); }});
      }}
      sorted.forEach(function(item) {{ grid.appendChild(item); }});
    }}

    function applyFilters() {{
      var q = search.value.trim().toLowerCase();
      var cat = category.value;
      var tier = tierSelect.value;
      var shown = 0;
      items.forEach(function(item) {{
        var matchesName = !q || item.dataset.name.indexOf(q) !== -1;
        var matchesCat = !cat || item.dataset.category === cat;
        var matchesTier = !tier || item.dataset.tier === tier;
        var visible = matchesName && matchesCat && matchesTier;
        item.hidden = !visible;
        if (visible) shown++;
      }});
      count.textContent = (q || cat || tier) ? ('Showing ' + shown + ' of ' + total) : ('Showing all ' + total);
      empty.hidden = shown !== 0;
      grid.hidden = shown === 0;

      var listShown = 0;
      listRows.forEach(function(rowEl) {{
        var matchesName = !q || rowEl.dataset.name.indexOf(q) !== -1;
        var matchesCat = !cat || rowEl.dataset.category === cat;
        var matchesTier = !tier || rowEl.dataset.tier === tier;
        var visible = matchesName && matchesCat && matchesTier;
        rowEl.hidden = !visible;
        if (visible) listShown++;
      }});
      listSections.forEach(function(section) {{
        var visibleRows = section.querySelectorAll('.db-row:not([hidden])');
        var sectionMatchesCat = !cat || section.dataset.category === cat;
        section.hidden = !sectionMatchesCat || visibleRows.length === 0;
      }});
      if (listEmpty) listEmpty.hidden = listShown !== 0;

      syncUrl();
    }}

    function runAll() {{
      applySort();
      applyFilters();
    }}

    search.addEventListener('input', runAll);
    category.addEventListener('change', runAll);
    tierSelect.addEventListener('change', runAll);
    sortSelect.addEventListener('change', runAll);
    if (listClear) {{
      listClear.addEventListener('click', function(e) {{
        e.preventDefault();
        search.value = '';
        category.value = '';
        tierSelect.value = '';
        runAll();
      }});
    }}

    var initial = paramsFromUrl();
    if (initial.q) search.value = initial.q;
    if (initial.cat) category.value = initial.cat;
    if (initial.tier) tierSelect.value = initial.tier;
    if (initial.sort) sortSelect.value = initial.sort;
    runAll();

    var activePopItem = null;
    function showPopover(item) {{
      activePopItem = item;
      popName.textContent = item.title;
      popDesc.textContent = item.dataset.desc || '';
      popFact.textContent = item.dataset.fact ? ('Cool fact: ' + item.dataset.fact) : '';
      popover.hidden = false;
      var rect = item.getBoundingClientRect();
      var top = rect.bottom + window.scrollY + 8;
      var left = rect.left + window.scrollX;
      var maxLeft = window.scrollX + document.documentElement.clientWidth - 300;
      if (left > maxLeft) left = Math.max(8, maxLeft);
      popover.style.top = top + 'px';
      popover.style.left = left + 'px';
    }}
    function hidePopover() {{
      popover.hidden = true;
      activePopItem = null;
    }}

    items.forEach(function(item) {{
      item.addEventListener('mouseenter', function() {{ showPopover(item); }});
      item.addEventListener('mouseleave', hidePopover);
      item.addEventListener('focus', function() {{ showPopover(item); }});
      item.addEventListener('blur', hidePopover);
      item.addEventListener('touchstart', function(e) {{
        if (activePopItem !== item) {{
          e.preventDefault();
          showPopover(item);
        }}
      }}, {{ passive: false }});
    }});
    document.addEventListener('click', function(e) {{
      if (activePopItem && !activePopItem.contains(e.target) && e.target !== activePopItem) hidePopover();
    }});
  }})();
  </script>

  <div class="subscribe-box">
    <h3>Get notified about new reviews</h3>
    <p>One email when a new tool gets tested, scored, and ranked. No spam, unsubscribe anytime.</p>
    <form class="subscribe-form" action="/api/subscribe" method="POST">
      <input type="email" name="email" placeholder="you@email.com" required aria-label="Email address">
      <button type="submit">Notify me</button>
    </form>
  </div>
</main>

<footer>
  <div class="wrap">
    <p>Solos Gems is an independent site. Some links may be affiliate links; we only recommend tools we'd use ourselves. See <a href="about.html">About</a> for details.</p>
  </div>
</footer>

</body>
</html>
'''

open(os.path.join(ROOT, "index.html"), "w", encoding="utf-8").write(PAGE)
print("wrote index.html")

# ---------------- Public data feed (JSON + CSV) ----------------
data_dir = os.path.join(ROOT, "data")
os.makedirs(data_dir, exist_ok=True)

def public_link(link, internal):
    return f"https://solosgems.com/{link}" if internal else link

tools_records = []
for name, domain, cat, desc, cool_fact, link, internal in sorted(TOOLS, key=lambda t: t[0].lower()):
    tools_records.append({
        "name": name,
        "domain": domain,
        "category": cat,
        "description": desc,
        "cool_fact": cool_fact,
        "url": public_link(link, internal),
        "reviewed_on_solosgems": internal,
        "pricing": price_bucket(desc, cool_fact),
        "date_added": date_added(name),
    })

tools_json_payload = {
    "source": "https://solosgems.com/",
    "generated": TODAY,
    "count": len(tools_records),
    "license": "Free to use with attribution to Solos Gems (solosgems.com).",
    "tools": tools_records,
}
with open(os.path.join(data_dir, "tools.json"), "w", encoding="utf-8") as f:
    json.dump(tools_json_payload, f, indent=2, ensure_ascii=False)
print(f"wrote data/tools.json ({len(tools_records)} tools)")

csv_path = os.path.join(data_dir, "tools.csv")
with open(csv_path, "w", encoding="utf-8", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "name", "domain", "category", "description", "cool_fact",
        "url", "reviewed_on_solosgems", "pricing", "date_added",
    ])
    writer.writeheader()
    writer.writerows(tools_records)
print(f"wrote data/tools.csv ({len(tools_records)} tools)")
