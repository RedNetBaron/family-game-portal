const games = [
  {
    name: 'Letter Grid',
    blurb: 'Find words in a grid of letters before time runs out.',
    href: '#/games/letter-grid',
  },
  { name: 'Category Dash', blurb: 'One letter, a list of categories. Fill them in fast.', href: null },
  { name: 'Family Trivia', blurb: 'Multiple-choice questions with a family scoreboard.', href: null },
];

export function Games() {
  return (
    <section className="games">
      <h2 className="menu-title">Pick a game</h2>
      <ul className="game-menu">
        {games.map((g) => (
          <li key={g.name}>
            {g.href ? (
              <a className="card menu-item" href={g.href}>
                <span>
                  <strong>{g.name}</strong>
                  <small>{g.blurb}</small>
                </span>
                <span className="chev" aria-hidden="true">›</span>
              </a>
            ) : (
              <div className="card menu-item soon" aria-disabled="true">
                <span>
                  <strong>{g.name}</strong>
                  <small>{g.blurb}</small>
                </span>
                <span className="badge">Coming soon</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
