import { useState, useEffect } from 'react';
import Hero from './components/Hero';
import VideoSection from './components/VideoSection';
import Features from './components/Features';
import HowItWorks from './components/HowItWorks';
import WhatsAppAI from './components/WhatsAppAI';
import SiteAI from './components/SiteAI';
import CTASection from './components/CTASection';
import Testimonials from './components/Testimonials';
import About from './components/About';
import Footer from './components/Footer';
import TopNavigation from '../../components/feature/TopNavigation';

export default function HomePage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen">
      <TopNavigation isScrolled={isScrolled} />
      <Hero />
      <VideoSection />
      <Features />
      <HowItWorks />
      <WhatsAppAI />
      <SiteAI />
      <CTASection />
      <Testimonials />
      <About />
      <Footer />
    </div>
  );
}
