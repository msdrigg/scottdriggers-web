import BrowserOnly from "@docusaurus/BrowserOnly";
import styles from "./styles.module.css";

// Docusaurus prerenders every page at build time, where File/WASM/Buffer don't
// exist. Gate the entire viewer behind BrowserOnly and require() the client
// module inside the render callback so sql.js and the Buffer-using decoders are
// only ever evaluated in the browser.
export default function ImessageViewer() {
    return (
        <BrowserOnly fallback={<div className={styles.root}>Loading the iMessage viewer…</div>}>
            {() => {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const Client = require("./ImessageViewerClient").default;
                return <Client />;
            }}
        </BrowserOnly>
    );
}
