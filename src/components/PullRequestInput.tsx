import { useState } from 'react'

import { lookupPullRequest, type LookupFailure, type PullRequestFiles } from '../services/github'

interface PullRequestInputProps {
  disabled: boolean
  onResolved: (files: PullRequestFiles) => void
  onFailed: (failure: LookupFailure) => void
}

/**
 * Paste a public pull request URL to fetch its changed files.
 *
 * This is an accelerator, not the main route: the URL supplies *what changed*, while
 * the chosen folder supplies the code to trace from. A URL alone cannot produce a
 * graph, so what comes back is checked against the folder before anything is marked.
 */
export function PullRequestInput({ disabled, onResolved, onFailed }: PullRequestInputProps) {
  const [value, setValue] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const input = value.trim()
    if (input.length === 0 || loading) return

    setLoading(true)
    try {
      const result = await lookupPullRequest(input)
      if (result.ok) onResolved(result.value)
      else onFailed(result.failure)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="pr-input" onSubmit={handleSubmit} noValidate>
      {/*
        Deliberately not `type="url"`: that makes the browser block submission of
        anything it does not recognise as a URL, with no message and no request made.
        The user would see the form simply refuse to do anything. The service already
        validates the input and explains what a pull request URL looks like, so the
        field stays a plain text input and the feedback is ours.
      */}
      <input
        type="text"
        value={value}
        disabled={disabled || loading}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Paste a pull request URL"
        aria-label="GitHub pull request URL"
        spellCheck={false}
        autoComplete="off"
      />
      <button
        type="submit"
        className="button"
        disabled={disabled || loading || value.trim().length === 0}
      >
        {loading ? 'Fetching…' : 'Use PR'}
      </button>
    </form>
  )
}
