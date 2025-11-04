import { motion } from 'framer-motion';
import { Phone, Play, ShieldCheck, Zap, Globe2, Globe, AlertCircle, ChartBar, Layers, Cpu, MessageSquare, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 }
};

const Landing = () => {
  return (
    <div className="min-h-screen bg-brand-white dark:bg-brand-dark">
      {/* Hero */}
      <section className="gradient-bg relative overflow-hidden">
        <div className="container max-w-7xl mx-auto px-6 py-20 md:py-28">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <motion.div variants={fadeUp} initial="hidden" animate="show" transition={{ duration: 0.6 }}>
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight text-brand-white dark:text-brand-white">
                Voice AI Agents Designed for Real Conversations
              </h1>
              <p className="mt-4 text-brand-white/90 max-w-xl">
                Automate customer calls across telephone, mobile apps, and web — with natural, intelligent conversations that truly sound human.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#demo" className="btn-primary inline-flex items-center">
                  <Phone className="w-5 h-5 mr-2" /> Call Now
                </a>
                <Link to="/register" className="btn-secondary">Contact Sales</Link>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 40 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="relative mx-auto w-full max-w-md">
                {/* Main glowing orb with floating effect */}
                <motion.div
                  className="aspect-square rounded-full  from-brand-light via-brand-sky to-brand-primary "
                  animate={{
                    scale: [1, 1.05, 1],
                    rotate: [0, 3, -3, 0],
                  }}
                  transition={{
                    duration: 6,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Soft floating glows with shimmer */}
                <motion.div
                  className="absolute -top-6 left-10 w-24 h-24 bg-brand-light/30 blur-2xl rounded-full"
                  animate={{
                    x: [0, 10, -10, 0],
                    opacity: [0.5, 0.8, 0.6, 0.5],
                  }}
                  transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                <motion.div
                  className="absolute bottom-10 -right-6 w-20 h-20 bg-brand-accent/20 blur-2xl rounded-full"
                  animate={{
                    y: [0, -15, 0],
                    opacity: [0.4, 0.6, 0.4],
                  }}
                  transition={{
                    duration: 7,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />

                {/* Background Image + Subtle Hover Glow */}
                <motion.div
                  className="absolute inset-0 flex items-center justify-center bg-center bg-no-repeat bg-contain"
                  style={{ backgroundImage: "url('/download.png')" }}
                  animate={{
                    scale: [1, 1.03, 1],
                    filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"],
                  }}
                  transition={{
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <motion.button
                    whileHover={{ scale: 1.1, boxShadow: "0 0 20px rgba(255,255,255,0.7)" }}
                    whileTap={{ scale: 0.95 }}
                    className="px-5 py-3 ml-6 rounded-full bg-brand-white/90 text-brand-primary font-semibold shadow-md flex items-center transition-all duration-300"
                  >
                    <Phone className="w-5 h-5 mr-2" /> Call Now
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>

          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section
        id="demo"
        className="container mx-auto  py-20 relative flex flex-col items-center"
      >
        {/* Heading */}
        <h2 className="text-3xl md:text-4xl font-bold text-center">
          No More Press 1, Press 2…
        </h2>
        <p className="text-center text-brand-muted mb-16">
          Experience conversational Voice AI built to handle real-world workflows
        </p>

        <div className=' bg-slate-100 rounded-[20px] mx-auto w-full max-w-7xl'>
          <motion.div
            initial={{ scale: 0.9 }}
            className="relative flex items-center justify-center"
          >
            <div className="relative flex items-center justify-center gap-4 h-24">
              {[0, 1, 2, 3,4,5,6,7,8,9,10].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-20 bg-brand-light rounded-full origin-center "
                  animate={{
                    scaleY: [0.4, 0.9, 0.5, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 1 + i * 0.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            {/* Background Shape */}
            <img
              src="/phn-shape.svg"
              className="w-[400px] max-w-[480px] mr-6 ml-6"
              alt="voice icon"
            />
            <div className="relative flex items-center justify-center gap-4 h-24">
              {[0, 1, 2, 3,4,5,6,7,8,9,10].map((i) => (
                <motion.div
                  key={i}
                  className="w-3 h-20 bg-brand-light rounded-full origin-center "
                  animate={{
                    scaleY: [0.4, 0.9, 0.5, 0.8, 0.4],
                  }}
                  transition={{
                    duration: 1 + i * 0.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              ))}
            </div>
            {/* Circle Container (static) */}
            <div className="absolute h-48 w-48 flex items-center justify-center rounded-full shadow-[0_0_40px_rgba(52,86,157,0.6)]">
              {/* Rotating Gradient Background */}
              <div className="absolute inset-0 rounded-full animate-gradient-spin bg-[conic-gradient(from_0deg,theme(colors.brand.primary),theme(colors.brand.accent),theme(colors.brand.secondary),theme(colors.brand.primary))]" />

              {/* Center-anchored music bars inside the orb */}
              <div className="relative flex items-center justify-center gap-3 h-24">
                {[0, 1, 2, 3].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-16 bg-white rounded-full origin-center shadow-[0_0_10px_rgba(255,255,255,0.7)]"
                    animate={{
                      scaleY: [0.4, 0.9, 0.5, 0.8, 0.4],
                    }}
                    transition={{
                      duration: 1 + i * 0.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Floating Use Case Cards */}
        {[
          { title: "Lead Qualification", top: "220px", left: "360px", img: "/Icon.svg" },
          { title: "Product Recommendation", top: "250px", right: "200px", img: "/Icon (1).svg" },
          { title: "Bookings and Appointments", bottom: "80px", left: "320px", img: "/Icon (2).svg" },
          { title: "Customer Support", bottom: "90px", right: "200px", img: "/Icon (3).svg" },
        ].map((item, idx) => (
          <motion.div
            key={idx}
            initial={{ y: 10, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            className="absolute w-auto bg-white shadow-lg rounded-2xl px-5 py-3 flex items-center gap-3"
            style={{ ...item }}
          >
            <img src={item.img} className="w-7 h-7" />
            <div>
              <h3 className="font-medium">{item.title}</h3>
              <p className="text-sm text-brand-muted">Play demo</p>
            </div>
            <button className="ml-4 inline-flex items-center px-3 py-1 rounded-full bg-brand-light text-brand-primary text-sm">
              <Play className="w-4 h-4 mr-1" /> Play
            </button>
          </motion.div>
        ))}
      </section>

      {/* Capabilities */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Supercharge Customer Experiences with AI Voice Agent</h3>
            <p className="text-brand-muted">Align voice agent with brand personality. Choose tone, accent, and depth that resonate with your customers.</p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Break the Language Barrier</h3>
            <p className="text-brand-muted">Support for 100+ languages with dialect preferences to speak where your customers are comfortable.</p>
          </div>
        </div>
      </section>

      {/* Analytics */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Launch Fast. Learn Faster.</h3>
            <p className="text-brand-muted">Go beyond surface metrics with actionable analytics: sentiment, adherence, and customer satisfaction.</p>
          </div>
          <div className="card">
            <h3 className="text-xl font-bold mb-2">Powerfully built. Seamlessly integrated.</h3>
            <ul className="space-y-2 text-brand-muted">
              <li className="flex items-center"><Zap className="w-4 h-4 mr-2 text-brand-accent" /> Best-in-class latency</li>
              <li className="flex items-center"><Layers className="w-4 h-4 mr-2 text-brand-accent" /> Integrate with existing stack</li>
              <li className="flex items-center"><ShieldCheck className="w-4 h-4 mr-2 text-brand-accent" /> Secure by design</li>
              <li className="flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-brand-accent" /> Built-in smart handover</li>
              <li className="flex items-center"><Globe2 className="w-4 h-4 mr-2 text-brand-accent" /> Enterprise-ready, developer-friendly</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-6 py-20 text-center">
        <motion.h3 className="text-2xl md:text-3xl font-bold" variants={fadeUp} initial="hidden" whileInView="show">Build your AI call center today</motion.h3>
        <div className="mt-6 flex justify-center gap-4">
          <Link to="/register" className="btn-primary">Get Started</Link>
          <Link to="/login" className="btn-secondary">Sign In</Link>
        </div>
      </section>
    </div>
  );
};

export default Landing;