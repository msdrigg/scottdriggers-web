import clsx from "clsx";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";
import { Timeline, TimelineItem } from "../components/Timeline/Timeline";
import { ReactNode } from "react";

export default function Home(): ReactNode {
  return (
    <Layout
      title={`Hello from Scott Driggers`}
      description="Personal webpage for Scott Driggers"
    >
      <div>
        <header
          className={clsx(
            "hero hero--primary shadow--lw margin--lg",
            styles.heroBanner,
          )}
        >
          Hi, I'm Scott Driggers
        </header>
      </div>
      <main className="px-8 py-4 space-y-8">
        <section>
          <Heading as="h2" className="text--left">
            Background
          </Heading>
          <p>
            I graduated from Clemson University with degrees in physics and
            mathematics. In college I focused on the theoretical side of these
            fields and studied subjects that ranged from quantum mechanics to
            abstract algebra.
          </p>
          <p>
            On top of these projects, I done some work in full stack development
            for saas systems in healthcare, enjoy writing in Rust when I can,
            built a few mobile apps with bluetooth features, experience in
            bluetooth development, experience in data science + visualization,
            experience in standard ml
          </p>
          <p>
            Love learning and what's next for me is learning to manage people,
            direct a project to completion and work more about the business side
            of things.
          </p>
          <p>
            Additionally I am hoping to get the chance to learn more on the
            hardware side (embedded systems, chip design, etc.)
          </p>
        </section>

        <section>
          <Heading as="h2" className="text-left">
            Experience
          </Heading>
          <Timeline>
            <TimelineItem date="2022-Present">
              <Heading as="h2">Systems Architect</Heading>
              <Heading as="h3" className={styles.cardHeader}>
                Poltys Inc.
              </Heading>
              <p>Lead engineer on Location Based Services project.</p>
              <p>
                Team lead on mobile healthcare application and primary backend
                engineer on the project
              </p>
            </TimelineItem>
            <TimelineItem date="2020-2022">
              <Heading as="h1">Data Scientist · Software Engineer</Heading>
              <Heading as="h3" className={styles.cardHeader}>
                Poltys Inc.
              </Heading>
              <p>
                Developed machine learning models for fall risk. Developed
                algorithms for indoor location tracking.
              </p>
            </TimelineItem>

            <TimelineItem date="Summer 2020">
              <Heading as="h1">Research Intern</Heading>
              <Heading as="h3" className={styles.cardHeader}>
                Oak Ridge National Lab
              </Heading>
              <p>
                Applied machine learning models to improve the performance of
                physics simulations.
              </p>
            </TimelineItem>

            <TimelineItem date="Summer 2019">
              <Heading as="h1">Research Intern</Heading>
              <Heading as="h3" className={styles.cardHeader}>
                Clemson University - SIN Group
              </Heading>
              <p>
                Worked on a project to deflect an ion beam in a strong vacuum
                using a 3D printed deflector.
              </p>
              <p>
                Developed control software to the temperature control system for
                the vacuum chamber, and wrote visualization software for the ion
                scattering simulation software.
              </p>
            </TimelineItem>

            <TimelineItem date="2018-2021">
              <Heading as="h1">B.S. Physics and B.S. Mathematics</Heading>
              <Heading as="h3" className={styles.cardHeader}>
                Clemson University
              </Heading>
              <p>
                Focused on computational and theoretical physics as well as
                not-very-applied mathematics.
              </p>
            </TimelineItem>
          </Timeline>
        </section>
        <section>
          <Heading as="h2" className="text--left">
            Fun facts
          </Heading>
          <div className="grow text-center grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            <div className={clsx("card", styles.card, "shadow--md")}>
              <div className="card__header">
                <Heading as={"h3"}>Home</Heading>
              </div>
              <div className="card__body">
                <p>I'm currently living in Columbia SC</p>
              </div>
            </div>
            <div className={clsx("card", styles.card, "shadow--md")}>
              <div className="card__header">
                <Heading as={"h3"}>Hobbies</Heading>
              </div>
              <div className="card__body">
                <p>
                  I enjoy ultimate frisbee, hiking, BJJ and anything outdoors.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
