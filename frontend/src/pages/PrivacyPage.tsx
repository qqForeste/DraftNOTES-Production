const UPDATED = '24 August 2026'

export function PrivacyPage() {
  return (
    <div className="flex justify-center py-8">
      <div className="flex w-[720px] flex-col gap-5 text-sm text-text-secondary">
        <div>
          <h1 className="text-xl font-bold text-text-headline">Privacy</h1>
          <p className="mt-1 text-[11px] text-text-muted">Last updated {UPDATED}</p>
        </div>

        <Section title="What we store">
          <p>
            When you sign in we store the account identifier your provider gives us, your
            email address, and your display name. When you link a Riot ID we store its PUUID,
            game name, tag line, platform, and current ranked standing.
          </p>
          <p className="mt-2">
            For each ranked match we sync, we store its result, your champion, your stat line,
            and the champions and names of the other players in that game, all of which comes
            from the Riot Games API. Notes and mistake tags you write are stored against your
            account and are visible only to you.
          </p>
        </Section>

        <Section title="What we do not do">
          <p>
            We do not sell your data, share it with advertisers, or run third-party analytics
            or tracking. We do not use your email for anything other than identifying your
            account. There are no ads on this site.
          </p>
        </Section>

        <Section title="Cookies">
          <p>
            One cookie, holding a signed session identifier so you stay signed in. It is not
            used for tracking and there are no third-party cookies.
          </p>
        </Section>

        <Section title="Deleting your data">
          <p>
            Deleting your account from the Account page removes your account, every note and
            tag you have written, and any match data no other player on this site still uses.
            It takes effect immediately and cannot be undone.
          </p>
        </Section>

        <Section title="Riot Games">
          <p>
            Match and ranked data comes from the Riot Games API and remains subject to Riot's
            own terms. Champion and item images come from Riot's Data Dragon service.
          </p>
        </Section>

        <p className="text-[11px] text-text-muted">
          DraftNotes isn't endorsed by Riot Games and doesn't reflect the views or opinions of
          Riot Games or anyone officially involved in producing or managing Riot Games
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
