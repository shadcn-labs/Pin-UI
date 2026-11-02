"use client";

import { motion, useReducedMotion } from "motion/react";
import PageBar from "../PageBar";
import SiteFooter from "./SiteFooter";
import TestimonialCard from "./TestimonialCard";
import { TESTIMONIALS } from "@/lib/testimonials";
import { softSpring } from "@/lib/motion";
import "../library/library.css";

/**
 * Every testimonial, on a page of its own — where the landing row's "View all"
 * goes. It wears the library page's bar and intro, so the two read as the same
 * kind of place, and the mark in the bar is the theme switch here as it is
 * everywhere else: the cards trade red for a red-ruled white with the rest.
 */
export default function TestimonialsIndex() {
  const reduced = useReducedMotion();
  const rise = (delay = 0) =>
    reduced
      ? {}
      : ({
          initial: { opacity: 0, y: 24 },
          animate: { opacity: 1, y: 0 },
          transition: { ...softSpring, delay },
        } as const);

  return (
    <div className="site lib-page">
      <PageBar />

      <main className="lib tqp" id="top">
        <section className="lib__intro">
          <motion.p className="lib__eyebrow" {...rise()}>
            Testimonials
          </motion.p>
          <motion.h1 className="lib__title" {...rise(0.05)}>
            What people are saying
          </motion.h1>
          <motion.p className="lib__lead tqp__lead" {...rise(0.1)}>
            Word for word, from the replies on X — each card links to the person who said it.
          </motion.p>
        </section>

        <div className="tqp__grid">
          {TESTIMONIALS.map((item, i) => (
            <motion.div
              className="tqp__item"
              key={item.handle}
              {...(reduced
                ? {}
                : {
                    initial: { opacity: 0, y: 24 },
                    whileInView: { opacity: 1, y: 0 },
                    viewport: { once: true, amount: 0.2 },
                    transition: { ...softSpring, delay: (i % 3) * 0.06 },
                  })}
            >
              <TestimonialCard item={item} id={`tqp-${i}`} still />
            </motion.div>
          ))}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
