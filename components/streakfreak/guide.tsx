import site from '@/lib/site-content.json';

// Rendered by the server page: readable without running the habit application.
export function Guide() {
  return (
    <div className="product-guide">
      <section
        id="about"
        aria-labelledby="about-heading"
        className="about-section"
      >
        <div>
          <p className="eyebrow">A LITTLE TOOL, ALL YOURS</p>
          <h2 id="about-heading">
            A private habit tracker.
            <br />A clearer picture of your days.
          </h2>
          <p>{site.summary}</p>
          <nav className="guide-links" aria-label="About Streakfreak">
            <a href="#how-it-works">How it works</a>
            <a href="#faq">Questions & answers</a>
            <a href="#makers">Meet the makers</a>
          </nav>
        </div>
        <ul className="feature-list">
          {site.features.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>
      <section
        id="how-it-works"
        aria-labelledby="how-heading"
        className="how-section"
      >
        <h2 id="how-heading">Small steps. A story worth keeping.</h2>
        <ol className="how-grid">
          <li>
            <h3>Make it yours</h3>
            <p>
              Pick a template or create a habit. Set a daily amount to reach or
              a limit to stay under.
            </p>
          </li>
          <li>
            <h3>Show up & reflect</h3>
            <p>
              Log your progress, then leave a closing note about what you
              achieved. Revisit any past day from the calendar.
            </p>
          </li>
          <li>
            <h3>Keep the whole picture</h3>
            <p>
              Watch your streaks grow. Export JSON for a backup or CSV to turn
              your progress and reflections into a report.
            </p>
          </li>
        </ol>
      </section>
      <section id="faq" aria-labelledby="faq-heading" className="faq-section">
        <div>
          <p className="eyebrow">GOOD TO KNOW</p>
          <h2 id="faq-heading">Questions, answered.</h2>
        </div>
        <div className="faq-list">
          {site.faqs.map(({ id, question, answer }) => (
            <article id={id} key={id}>
              <h3>{question}</h3>
              <p>{answer}</p>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="companion-heading">
        <p className="eyebrow">ONE MORE TOOL FOR YOUR DAILY RITUAL</p>
        <h2 id="companion-heading">{site.companion.heading}</h2>
        <a
          className="companion-card"
          href={site.companion.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          <div>
            <h3>Settle in with {site.companion.name}</h3>
            <p>{site.companion.description}</p>
          </div>
          <span className="companion-arrow" aria-hidden="true">
            ↗
          </span>
        </a>
      </section>
      <section
        id="makers"
        aria-labelledby="makers-heading"
        className="makers-section"
      >
        <div>
          <p className="eyebrow">EVERY STREAK STARTS WITH SOMEONE</p>
          <h2 id="makers-heading">
            You bring the consistency.
            <br />
            We bring the little tools.
          </h2>
          <p>
            One of the small, useful things at{' '}
            <a
              href="https://lowkey.tools"
              target="_blank"
              rel="noopener noreferrer"
            >
              Lowkey Tools
            </a>
            . Made by{' '}
            <a
              href="https://shrinath.me"
              target="_blank"
              rel="author noopener noreferrer"
            >
              Shrinath Prabhu
            </a>
            , from the makers of{' '}
            <a
              href="https://owleye.dev"
              target="_blank"
              rel="noopener noreferrer"
            >
              OwlEye Analytics
            </a>
            .
          </p>
          <a
            className="maker-follow"
            href="https://x.com/shrinath_prabhu"
            target="_blank"
            rel="noopener noreferrer"
          >
            Follow the next idea: @shrinath_prabhu on X{' '}
            <span aria-hidden="true">↗</span>
          </a>
        </div>
        <div className="maker-links">
          <a
            href="https://owleye.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>FROM THE MAKERS OF</span>
            <strong>
              Explore OwlEye Analytics <span aria-hidden="true">↗</span>
            </strong>
            <small>owleye.dev</small>
          </a>
          <a
            href="https://shrinath.me"
            target="_blank"
            rel="author noopener noreferrer"
          >
            <span>THE MAKER&apos;S NOTEBOOK</span>
            <strong>
              More from Shrinath Prabhu <span aria-hidden="true">↗</span>
            </strong>
            <small>shrinath.me</small>
          </a>
        </div>
      </section>
    </div>
  );
}
