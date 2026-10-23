import { FolderPicker } from './FolderPicker'
import {
  EvidenceFragment,
  GraphFragment,
  MismatchFragment,
  PayoffFragment,
} from './GraphFragment'
import { GraphPreview } from './GraphPreview'
import { ThemeSwitcher } from './ThemeSwitcher'
import { useReveal } from '../hooks/useReveal'
import type { SourceFile } from '../lib/graph'

interface HeroProps {
  onFilesSelected: (files: SourceFile[], folderName: string) => void
  disabled: boolean
}

/**
 * The landing page.
 *
 * It has one job: make the offer clear before the visitor has to commit
 * anything. The graph behind the words is the bundled sample repository drawing
 * itself — the same files, the same imports and the same blast radius the tool
 * would draw, so the mechanism is shown rather than described. The folder
 * picker is the real action rather than a link to one.
 */
export function Hero({ onFilesSelected, disabled }: HeroProps) {
  const steps = useReveal<HTMLOListElement>()
  const channels = useReveal<HTMLDivElement>()
  const payoff = useReveal<HTMLDivElement>()
  const evidence = useReveal<HTMLDivElement>()
  const refusals = useReveal<HTMLDivElement>()
  const footer = useReveal<HTMLElement>()

  return (
    <div className="hero">
      <section className="hero-stage">
        {/* The graph is the ground the page sits on, not a picture inside it. */}
        <div className="hero-field">
          <GraphPreview />
        </div>

        <header className="hero-masthead">
          <span className="brand">
            <span className="brand-mark" />
            Impact Map
          </span>
          <div className="hero-masthead-actions">
            <ThemeSwitcher />
            <a className="hero-header-link" href="#start">
              Open a folder
            </a>
          </div>
        </header>

        <div className="hero-copy">
          <h1>Every file your change reaches.</h1>
          <p className="hero-lede">
            Impact Map reads a folder of JavaScript or TypeScript, follows the
            imports, and shows what your change reaches.
          </p>

          <div className="hero-action" id="start">
            <FolderPicker
              variant="hero"
              onFilesSelected={onFilesSelected}
              disabled={disabled}
              showHint={false}
            />
            <p className="hero-note">
              Chrome, Edge, Brave or Arc. Your code is read in the page and never
              leaves your machine.
            </p>
          </div>
        </div>
      </section>

      <section className="hero-section">
        <h2>How it works</h2>
        <ol className="hero-flow reveal" ref={steps}>
          <li>
            <h3>Read the folder</h3>
            <p>
              It takes the JavaScript and TypeScript inside and draws the import
              graph. Nothing is uploaded.
            </p>
          </li>
          <li>
            <h3>Name the change</h3>
            <p>
              Paste a pull request URL, or click the files you touched. Either way
              you end up with the same starting point.
            </p>
          </li>
          <li>
            <h3>Trace it</h3>
            <p>
              Everything those files reach lights up, nearest first. Click any of
              them for the imports that prove it.
            </p>
          </li>
        </ol>
      </section>

      <section className="hero-section hero-section-alt">
        <h2>How to read the graph</h2>
        <div className="hero-read reveal" ref={channels}>
          <div className="hero-read-text">
            <p>
              The fill of a file says how far it is from your change. Orange is the
              file you changed. Purple is a file your change reaches. Grey is a file
              it does not reach.
            </p>
            <p>
              The badge says something else. A blue ring means a test imports that
              file, directly or through another module. A solid red dot means nothing
              does.
            </p>
          </div>

          <GraphFragment />
        </div>
      </section>

      <section className="hero-section">
        <h2>The state worth seeing</h2>
        <div className="hero-read reveal" ref={payoff}>
          <div className="hero-read-text">
            <p>
              You changed a file, and nothing tests it. That is one orange card with
              a red badge in it, and it is on the graph before you click anything.
            </p>
            <p>
              Here it is in the sample repository, with the two files that import it
              lit up around it.
            </p>
          </div>

          <PayoffFragment />
        </div>
      </section>

      <section className="hero-section hero-section-alt">
        <h2>How it proves itself</h2>
        <div className="hero-read reveal" ref={evidence}>
          <div className="hero-read-text">
            <p>
              A graph that says a file is affected is a claim. Click any file and
              the panel shows the chain of imports that connects it back to your
              change, one hop at a time.
            </p>
            <p>
              It is the shortest chain, and it is shown verbatim rather than
              summarised, because a paraphrase is not something you can check.
            </p>
          </div>

          <EvidenceFragment />
        </div>
      </section>

      <section className="hero-section">
        <h2>What it will not do</h2>
        <div className="hero-refusals reveal" ref={refusals}>
          <div>
            <h3>It will not trace a pull request that disagrees with your folder.</h3>
            <p>
              If the files a pull request names are not in the folder you picked, it
              lists them by name and marks nothing. Drawing the blast radius of a
              change you did not make would look convincing and be wrong.
            </p>
          </div>
          <div>
            <h3>It will not guess why a pull request cannot be read.</h3>
            <p>
              A private repository, a deleted one and a typo all come back as the same
              404. The tool says the pull request could not be read, because that is
              the part it actually knows.
            </p>
          </div>
        </div>

        <div className="hero-read hero-read-below">
          <div className="hero-read-text">
            <p>
              Here is that refusal, with the real files it names. The two that are
              present are offered, by name, and nothing is marked until you say so.
            </p>
          </div>

          <MismatchFragment />
        </div>
      </section>

      <footer className="hero-footer reveal" ref={footer}>
        <div className="hero-footer-copy">
          <h2>Run it on your own code</h2>
          <p>
            Nothing is uploaded, and nothing is kept. Close the tab and the analysis
            is gone.
          </p>
          <pre className="hero-code">
            <code>
              npm install{'\n'}npm run dev
            </code>
          </pre>
          <p className="hero-note">
            Then open the local URL and choose a folder. A sample repository is
            bundled, so you can try it before pointing it at your own code.
          </p>
        </div>
        <div className="hero-footer-action">
          <FolderPicker
            variant="hero"
            onFilesSelected={onFilesSelected}
            disabled={disabled}
            showHint={false}
          />
        </div>
      </footer>
    </div>
  )
}
