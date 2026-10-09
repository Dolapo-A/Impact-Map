import type { LookupFailure } from '../services/github'
import { describeFailure } from '../services/github'
import type { MismatchOutcome } from '../lib/mismatch'

interface MismatchNoticeProps {
  /** A failed lookup — nothing to compare, so only the reason can be reported. */
  failure?: LookupFailure
  /** A successful lookup that disagrees with the chosen folder. */
  outcome?: MismatchOutcome
  /** Continue by marking files by hand instead. Always available. */
  onDismiss: () => void
  /** Mark the files that *were* found, having seen what is missing. */
  onMarkFound?: () => void
  found?: string[]
}

function MissingFiles({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null

  return (
    <>
      <p className="mismatch-files-label">
        {missing.length === 1 ? 'File not in this folder:' : `Files not in this folder (${missing.length}):`}
      </p>
      <ul className="mismatch-files">
        {missing.map((file) => (
          <li key={file}>
            <code>{file}</code>
          </li>
        ))}
      </ul>
    </>
  )
}

/**
 * The refusal to proceed on bad evidence.
 *
 * This is a designed state, not an error message. The tool's claim is that every
 * claim it makes can be verified, and a confidently wrong graph would violate that
 * more seriously than a missing feature would. So the notice names the specific
 * files it could not find, explains what that usually means, and always leaves a
 * way forward — manual marking works from here.
 */
export function MismatchNotice({ failure, outcome, onDismiss, onMarkFound, found = [] }: MismatchNoticeProps) {
  return (
    <div className="notice notice-mismatch" role="alert">
      {failure && (
        <>
          <p className="mismatch-title">Pull request not used</p>
          <p className="mismatch-body">{describeFailure(failure)}</p>
        </>
      )}

      {outcome?.kind === 'none-match' && (
        <>
          <p className="mismatch-title">This folder doesn't match that pull request</p>
          <p className="mismatch-body">
            None of the files the pull request changes are in the folder you chose. The
            two look like different repositories, or the same repository at different
            commits. Nothing has been marked.
          </p>
        </>
      )}

      {outcome?.kind === 'partial' && (
        <>
          <p className="mismatch-title">Some changed files are missing from this folder</p>
          <p className="mismatch-body">
            {found.length} of the pull request's {found.length + outcome.missing.length} changed
            files {found.length === 1 ? 'is' : 'are'} here, so the folder is a different commit
            or a partial copy. Nothing has been marked automatically.
          </p>
        </>
      )}

      {outcome && <MissingFiles missing={outcome.kind === 'match' ? [] : outcome.missing} />}

      <div className="mismatch-actions">
        {onMarkFound && found.length > 0 && (
          <button type="button" className="button" onClick={onMarkFound}>
            Mark the {found.length} file{found.length === 1 ? '' : 's'} that are here
          </button>
        )}
        <button type="button" className="button" onClick={onDismiss}>
          Mark files manually
        </button>
      </div>
    </div>
  )
}
