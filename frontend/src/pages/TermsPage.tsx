const UPDATED = '25 August 2026'

export function TermsPage() {
  return (
    <div className="flex justify-center py-8">
      <div className="flex w-[720px] flex-col gap-5 text-sm text-text-secondary">
        <div>
          <h1 className="text-xl font-bold text-text-headline">Terms of service</h1>
          <p className="mt-1 text-[11px] text-text-muted">Last updated {UPDATED}</p>
        </div>

        <Section title="What this is">
          <p>
            DraftNotes is a free tool for reviewing your own ranked League of Legends
            matches and writing private notes about them. It is run by one person as a
            personal project, not by a company.
          </p>
        </Section>

        <Section title="Your account">
          <p>
            You sign in through Google or Discord and link a Riot ID. Link an account you
            actually play on. We do not currently verify ownership, so claiming someone
            else's Riot ID only wastes your own sync allowance and shows you their public
            match history, which is already public.
          </p>
          <p className="mt-2">
            You are responsible for what you write in your notes. Keep one account per
            person.
          </p>
        </Section>

        <Section title="Fair use">
          <p>
            Match data is fetched from Riot's API, which is rate limited. Syncing is
            queued and capped per account. Do not script against this site, scrape it, or
            try to work around those limits. Doing so risks the API access the whole site
            depends on, and accounts that do it will be removed.
          </p>
        </Section>

        <Section title="No guarantees">
          <p>
            The service is provided as is, with no warranty. It may be slow, briefly
            unavailable, or discontinued. Riot may change or withdraw API access at any
            time, which would stop match syncing entirely.
          </p>
          <p className="mt-2">
            Keep your own copy of anything you would be upset to lose. Nothing here is
            coaching advice or a guarantee of improvement.
          </p>
        </Section>

        <Section title="Ending it">
          <p>
            Delete your account at any time from the Account page, which removes your
            notes immediately. We may remove accounts that abuse the service or put its
            Riot API access at risk.
          </p>
        </Section>

        <Section title="Changes">
          <p>
            These terms may change. The date at the top says when they last did.
            Continuing to use the site means the current version applies.
          </p>
        </Section>

        <p className="text-[11px] text-text-muted">
          DraftNotes isn't endorsed by Riot Games and doesn't reflect the views or opinions
          of Riot Games or anyone officially involved in producing or managing Riot Games
          properties. Riot Games, and all associated properties are trademarks or registered
          trademarks of Riot Games, Inc.
        </p>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-card-border bg-card p-4">
      <h2 className="mb-2 text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  )
}
