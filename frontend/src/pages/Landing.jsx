import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Navbar from '../components/Navbar.jsx';
import Footer from '../components/Footer.jsx';
import './Landing.css';

gsap.registerPlugin(ScrollTrigger);

const MARQUEE_ITEMS = [
  'Resume Builder', 'FAANG Format', 'LinkedIn Jobs', 'PDF Export',
  'GPT-4o Powered', 'ATS Optimized', 'No Signup', 'Free to Use',
];

const FEATURES = [
  {
    num: '01',
    tag: 'Resume Builder',
    title: 'FAANG-standard format, instantly.',
    desc: 'Paste your resume or upload a PDF. The AI restructures it to the exact one-page format that gets callbacks at Google, Meta, and Apple.',
  },
  {
    num: '02',
    tag: 'Job Search',
    title: 'Find the right roles right now.',
    desc: 'Tell it your target role and city. It scrapes live LinkedIn listings and surfaces the top matches with direct application links.',
  },
  {
    num: '03',
    tag: 'Conversational AI',
    title: 'Just say what you need.',
    desc: 'No forms. No settings. Type or upload — the AI handles the rest in a single conversation. Ask once, get your resume back.',
  },
];

const STEPS = [
  { n: '01', title: 'Share your resume', desc: 'Paste your text or upload a PDF. The AI reads your full background and work history.' },
  { n: '02', title: 'Tell it what you want', desc: 'Ask it to reformat, target a new role, or search for matching jobs — in plain English.' },
  { n: '03', title: 'Download and apply', desc: 'Get a polished, ATS-optimized PDF ready to attach to any application. Takes minutes.' },
];

export default function Landing() {
  const pageRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero line mask reveal
      gsap.fromTo('.hero-line',
        { yPercent: 108 },
        { yPercent: 0, stagger: 0.13, duration: 0.9, ease: 'power3.out', delay: 0.15 }
      );

      // Hero supporting elements
      gsap.fromTo(
        ['.hero-badge', '.hero-desc', '.hero-actions', '.hero-trust'],
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, stagger: 0.09, duration: 0.65, ease: 'power2.out', delay: 0.6 }
      );

      // Hero card slide in
      gsap.fromTo('.hero-visual',
        { opacity: 0, x: 56 },
        { opacity: 1, x: 0, duration: 1.05, ease: 'power3.out', delay: 0.3 }
      );

      // Floating card animation
      gsap.to('.hero-mock', {
        y: -10,
        duration: 3.2,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
      });

      // Generic scroll reveals
      gsap.utils.toArray('.gs-reveal').forEach((el) => {
        gsap.fromTo(el,
          { opacity: 0, y: 36 },
          {
            opacity: 1, y: 0, duration: 0.7, ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 82%', once: true },
          }
        );
      });

      // Feature cards stagger
      const cards = gsap.utils.toArray('.feature-card');
      if (cards.length) {
        gsap.fromTo(cards,
          { opacity: 0, y: 32 },
          {
            opacity: 1, y: 0, stagger: 0.12, duration: 0.65, ease: 'power2.out',
            scrollTrigger: { trigger: cards[0], start: 'top 85%', once: true },
          }
        );
      }

      // Step items stagger
      const steps = gsap.utils.toArray('.step-item');
      if (steps.length) {
        gsap.fromTo(steps,
          { opacity: 0, y: 28 },
          {
            opacity: 1, y: 0, stagger: 0.15, duration: 0.6, ease: 'power2.out',
            scrollTrigger: { trigger: steps[0], start: 'top 80%', once: true },
          }
        );
      }
    }, pageRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="landing" ref={pageRef}>
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero" aria-label="Hero">
        <div className="hero-glow" aria-hidden="true" />
        <div className="container hero-inner">

          <div className="hero-content">
            <div className="hero-badge badge">
              <span className="badge-dot" aria-hidden="true" />
              Free &mdash; No signup required
            </div>

            <h1 className="heading-xl hero-title">
              <div className="line-clip"><span className="hero-line">Land the job</span></div>
              <div className="line-clip"><span className="hero-line">you <em>actually</em> want.</span></div>
            </h1>

            <p className="hero-desc">
              Your resume, restructured to the exact format that gets callbacks at Google, Meta, and Amazon.
              Find matching jobs without leaving the chat.
            </p>

            <div className="hero-actions">
              <Link to="/builder" className="btn-primary">
                Start for free
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              <a href="#how-it-works" className="btn-secondary">How it works</a>
            </div>

            <div className="hero-trust">
              <span>No signup</span>
              <span className="trust-sep" aria-hidden="true">·</span>
              <span>Free PDF export</span>
              <span className="trust-sep" aria-hidden="true">·</span>
              <span>GPT-4o powered</span>
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-mock">
              <div className="mock-header">
                <div className="mock-dots">
                  <span style={{ background: '#FF5F57' }} />
                  <span style={{ background: '#FEBC2E' }} />
                  <span style={{ background: '#28C840' }} />
                </div>
                <span className="mock-title">ResumeAI</span>
              </div>
              <div className="mock-body">
                <div className="mock-msg mock-user">
                  Reformat my resume to FAANG standard
                </div>
                <div className="mock-msg mock-ai">
                  <div className="mock-avatar">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <span>Done! Restructured to FAANGPath layout. Here&apos;s your file:</span>
                </div>
                <a className="mock-download">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  resume.pdf
                </a>
              </div>
            </div>
            <div className="hero-float-tag">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              ATS-Optimized
            </div>
          </div>

        </div>
      </section>

      {/* ── Marquee ── */}
      <div className="marquee-wrap" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <span key={i} className="marquee-item">
              {item} <span className="marquee-gem">◆</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Features ── */}
      <section id="features" className="section features-section" aria-label="Features">
        <div className="container">
          <div className="section-intro gs-reveal">
            <span className="section-label">What it does</span>
            <h2 className="heading-lg">Two tools.<br />One conversation.</h2>
          </div>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <article key={f.num} className="feature-card card">
                <span className="feature-num">{f.num}</span>
                <span className="feature-tag">{f.tag}</span>
                <h3 className="heading-md feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="how-it-works" className="section steps-section" aria-label="How it works">
        <div className="container">
          <div className="section-intro gs-reveal">
            <span className="section-label">How it works</span>
            <h2 className="heading-lg">Up and running<br />in minutes.</h2>
          </div>
          <div className="steps-grid">
            {STEPS.map((s) => (
              <div key={s.n} className="step-item">
                <div className="step-num">{s.n}</div>
                <h3 className="heading-md step-title">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="section cta-section" aria-label="Call to action">
        <div className="container">
          <div className="cta-block gs-reveal">
            <div className="cta-glow" aria-hidden="true" />
            <h2 className="heading-lg cta-title">Ready when you are.</h2>
            <p className="cta-desc">No account. No credit card. Just your next job.</p>
            <Link to="/builder" className="btn-primary cta-btn">
              Build my resume free
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
