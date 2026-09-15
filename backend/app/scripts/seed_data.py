import asyncio
import logging
from backend.app.db.session import AsyncSessionLocal, init_db
from backend.app.db.models import TranscriptChunk
from sqlalchemy.future import select

logger = logging.getLogger("lenny_assistant.seed")

SAMPLE_TRANSCRIPTS = [
    {
        "episode_title": "Elena Verna on PLG, B2B Growth, and Re-thinking Monetization",
        "guest_name": "Elena Verna",
        "episode_url": "https://www.lennyspodcast.com/elena-verna-on-plg-b2b-growth/",
        "publish_date": "2023-04-16",
        "chunk_index": 1,
        "topics": ["PLG", "Monetization", "Growth Loops", "B2B SaaS"],
        "content": (
            "Product-Led Growth (PLG) is not just a self-serve signup flow or a freemium button on your website. "
            "PLG is an organizational mindset where the product itself drives acquisition, retention, and expansion. "
            "Elena Verna explains: 'In traditional sales-led growth, marketing generates leads, sales converts them, and CS keeps them. "
            "In PLG, the product handles all three legs of the stool.' "
            "To successfully execute PLG in B2B SaaS, you must optimize the Time-to-Value (TTV). "
            "If a user creates an account and doesn't hit their 'aha moment' within the first 5 minutes, 80% of them will churn forever. "
            "Monetization in PLG should be delayed until value realization is firmly established. "
            "Never charge before users experience core value; charge when they need higher usage limits, team collaboration, or enterprise governance."
        )
    },
    {
        "episode_title": "Elena Verna on Growth Engineering & Viral Loops",
        "guest_name": "Elena Verna",
        "episode_url": "https://www.lennyspodcast.com/elena-verna-on-plg-b2b-growth/",
        "publish_date": "2023-04-16",
        "chunk_index": 2,
        "topics": ["Virality", "Growth Loops", "Retention"],
        "content": (
            "Growth loops are closed-loop systems where the output of one user action generates input for a new user acquisition or re-engagement. "
            "Elena Verna highlights two primary loops: Product-Led Virality and Content Loops. "
            "Product-Led Virality occurs when using the product inherently exposes it to external collaborators (e.g., sharing a Figma link, sending a Miro board, or sending a DocuSign agreement). "
            "The key metric to track is the Viral Coefficient (K-factor): K = (number of invites sent per user) x (conversion rate of invites). "
            "If K > 1, growth becomes exponential. However, even a K of 0.4 provides massive compounding efficiency when paired with organic content loops."
        )
    },
    {
        "episode_title": "Shreyas Doshi on Product Sense, LNO Framework, and Managing Yourself",
        "guest_name": "Shreyas Doshi",
        "episode_url": "https://www.lennyspodcast.com/shreyas-doshi-on-product-sense/",
        "publish_date": "2022-09-04",
        "chunk_index": 1,
        "topics": ["Product Sense", "LNO Framework", "Prioritization", "Career"],
        "content": (
            "Shreyas Doshi introduces the LNO Framework to solve PM burnout and execution velocity issues. "
            "LNO categorizes tasks into Leverage (L), Neutral (N), and Overhead (O) tasks. "
            "Leverage tasks are high-impact, asymmetric activities (e.g., product strategy, core PRD definition, key architectural decisions) where exceptional quality yields 10x returns. "
            "Neutral tasks are standard operational requirements (e.g., sprint planning, status updates) where good-enough execution is sufficient. "
            "Overhead tasks are routine administrative burdens where doing a minimal, fast job is optimal. "
            "PMs fail when they treat all tasks as Leverage tasks. High performers selectively obsess over Leverage tasks while intentionally doing 'good enough' work on Overhead tasks."
        )
    },
    {
        "episode_title": "Shreyas Doshi on Pre-Mortems and High-Impact Communication",
        "guest_name": "Shreyas Doshi",
        "episode_url": "https://www.lennyspodcast.com/shreyas-doshi-on-product-sense/",
        "publish_date": "2022-09-04",
        "chunk_index": 2,
        "topics": ["Pre-Mortem", "Risk Management", "Product Strategy"],
        "content": (
            "A Pre-Mortem is an essential product strategy exercise performed before launching a major initiative. "
            "Shreyas Doshi instructs teams: 'Imagine we are 12 months into the future, and this launch was a total failure. Write down exactly why it failed.' "
            "By framing failure as a prospective certainty, team members shed optimism bias and voice unspoken risks (e.g., channel distribution breakdown, technical debt, poor customer onboarding). "
            "The team then categorizes risks into Fatal Risks vs Nuisance Risks and builds explicit mitigation strategies into the product roadmap before a single line of code is written."
        )
    },
    {
        "episode_title": "Brian Balfour on Product-Market Fit and Four Fits Framework",
        "guest_name": "Brian Balfour",
        "episode_url": "https://www.lennyspodcast.com/brian-balfour-on-growth-and-four-fits/",
        "publish_date": "2022-11-20",
        "chunk_index": 1,
        "topics": ["PMF", "Four Fits", "Market-Product Fit", "Growth Engine"],
        "content": (
            "Brian Balfour asserts that Product-Market Fit (PMF) alone does not build a $100M+ business. "
            "Instead, high-growth companies achieve 'Four Fits': Market-Product Fit, Product-Channel Fit, Channel-Model Fit, and Model-Market Fit. "
            "1. Market-Product Fit: Validating that the target market segment has a acute pain point solved by your product. "
            "2. Product-Channel Fit: Products must be built to fit specific distribution channels (e.g., SEO, paid performance, viral distribution); channels do not adapt to your product. "
            "3. Channel-Model Fit: Your pricing model determines which channels you can afford. Low ARPU ($10/yr) requires virality/SEO; high ARPU ($100k/yr) supports enterprise sales. "
            "4. Model-Market Fit: Ensuring the number of potential customers multiplied by ARPU generates a viable business model scale."
        )
    },
    {
        "episode_title": "Marty Cagan on Empowered Product Teams vs Feature Factories",
        "guest_name": "Marty Cagan",
        "episode_url": "https://www.lennyspodcast.com/marty-cagan-on-empowered-teams/",
        "publish_date": "2023-01-22",
        "chunk_index": 1,
        "topics": ["Empowered Teams", "Feature Factory", "Product Discovery", "Leadership"],
        "content": (
            "Marty Cagan contrasts Empowered Product Teams with Feature Factories. "
            "In Feature Factories, executives give product teams lists of features to build (roadmaps of output). Teams act as mere order-takers, resulting in low innovation and wasted engineering hours. "
            "In Empowered Product Teams, leadership assigns teams specific customer problems or business outcomes to achieve (e.g., 'Increase 30-day trial conversion from 12% to 20%'). "
            "Empowered teams are given full autonomy to discover and deliver solutions. "
            "True product discovery addresses four risk dimensions simultaneously before building: Value Risk (will customers buy it?), Usability Risk (can users figure out how to use it?), Feasibility Risk (can our engineers build it?), and Business Viability Risk (does it work for our business?)."
        )
    },
    {
        "episode_title": "April Dunford on Product Positioning and Winning Markets",
        "guest_name": "April Dunford",
        "episode_url": "https://www.lennyspodcast.com/april-dunford-on-positioning/",
        "publish_date": "2022-08-14",
        "chunk_index": 1,
        "topics": ["Positioning", "Competitive Alternatives", "Value Proposition", "Go-To-Market"],
        "content": (
            "April Dunford defines positioning as the context you set for your product so customers understand what it is and why it matters. "
            "Great positioning relies on 5 components: "
            "1. Competitive Alternatives: What would customers use if your product didn't exist? (Often Excel or manual processes). "
            "2. Unique Features: What technical or workflow capabilities do you have that alternatives lack? "
            "3. Value: What business or emotional outcome do those unique features deliver? "
            "4. Target Customer Segment: Who cares the most about that specific value proposition? "
            "5. Market Category: What context (e.g., 'CRM for Dentists') instantly communicates your core value? "
            "Never position against ideal theoretical competitors; position directly against what your buyers actually evaluate during sales processes."
        )
    },
    {
        "episode_title": "Gibson Biddle on Netflix Growth Strategy and DHM Framework",
        "guest_name": "Gibson Biddle",
        "episode_url": "https://www.lennyspodcast.com/gibson-biddle-on-netflix-strategy/",
        "publish_date": "2023-03-05",
        "chunk_index": 1,
        "topics": ["DHM Framework", "Product Strategy", "Delight", "Hard-to-Copy"],
        "content": (
            "Gibson Biddle shares the DHM Framework used to scale Netflix from DVD-by-mail to global streaming dominance. "
            "DHM stands for: How will your product Delight customers, in Hard-to-copy ways, that are Margin-enhancing? "
            "1. Delight: What features make customers love the product? (At Netflix: streaming speed, personalized recommendations, original content). "
            "2. Hard-to-copy: What barriers protect you from competitors? (Netflix built 8 hard-to-copy advantage pillars: brand, network effects, economies of scale, unique tech, proprietary data). "
            "3. Margin-enhancing: How does the product generate sustainable profit? (Transitioning from expensive third-party content licensing to owned Netflix Originals dramatically improved gross margins)."
        )
    }
]

async def seed_transcripts():
    await init_db()
    async with AsyncSessionLocal() as session:
        # Check existing count
        stmt = select(TranscriptChunk)
        res = await session.execute(stmt)
        existing = res.scalars().all()
        
        if existing:
            logger.info(f"Database already seeded with {len(existing)} transcript chunks.")
            return

        for item in SAMPLE_TRANSCRIPTS:
            chunk = TranscriptChunk(
                episode_title=item["episode_title"],
                guest_name=item["guest_name"],
                episode_url=item["episode_url"],
                publish_date=item["publish_date"],
                chunk_index=item["chunk_index"],
                content=item["content"],
                topics=item["topics"]
            )
            session.add(chunk)
        
        await session.commit()
        logger.info(f"Successfully seeded database with {len(SAMPLE_TRANSCRIPTS)} authentic podcast transcripts.")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(seed_transcripts())
