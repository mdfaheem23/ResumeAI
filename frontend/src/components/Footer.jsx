import { Link } from 'react-router-dom';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link to="/" className="footer-logo">ResumeAI</Link>
          <p className="footer-tagline">Built for people who deserve better jobs.</p>
        </div>

        <div className="footer-cols">
          <div className="footer-col">
            <h4>Product</h4>
            <Link to="/builder">Resume Builder</Link>
            <a href="/#features">Features</a>
            <a href="/#how-it-works">How it works</a>
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href="https://huggingface.co/spaces/mdfaheem2306/ResumeBuilder_JobScraper_Agent" target="_blank" rel="noopener noreferrer">HF Space</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <p>&copy; {new Date().getFullYear()} ResumeAI &mdash; Free forever.</p>
        </div>
      </div>
    </footer>
  );
}
