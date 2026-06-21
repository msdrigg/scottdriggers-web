import clsx from "clsx";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";

import styles from "./index.module.css";
import { ReactNode } from "react";

function HomepageHeader() {
  return (
    <header className="text--center print:hidden">
      <div className="container">
        <div className="avatar avatar--vertical">
          <img
            className={clsx(styles.mainAvatar, "avatar__photo margin--md")}
            alt="Scott Driggers"
            src="https://gravatar.com/avatar/c7abdf73e309877ecf09e03f27d44a4530dbb98035e47bd86b001a396d095a9b?size=2048"
          />
        </div>
        <Heading as="h2" className="hero__title">
          Scott Driggers
        </Heading>
      </div>
    </header>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title={`Hello from Scott Driggers`}
      description="Personal webpage for Scott Driggers"
    >
      <div className={styles.mainSectionWrapper}>
        <HomepageHeader />

        <main className={styles.main}>
          <div className="grow px-4 text-center">
            <p>
              I am a software engineer working on projects in web development
              (mostly backend), data science, networking and mobile app
              development
            </p>
          </div>
        </main>
      </div>
    </Layout>
  );
}
