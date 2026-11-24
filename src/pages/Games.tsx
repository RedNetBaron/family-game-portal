const upcoming = [
  { name: 'Letter Grid', blurb: 'Find words in a grid of letters before time runs out.' },
  { name: 'Category Dash', blurb: 'One letter, a list of categories. Fill them in fast.' },
  { name: 'Family Trivia', blurb: 'Multiple-choice questions with a family scoreboard.' },
];

export function Games() {
  return (
    <section className="games">
      <p className="hint">Each game will offer live play or take-turns play.</p>
      {upcoming.map((g) => (
        <article key={g.name} className="card game">
          <h3>{g.name}</h3>
          <p>{g.blurb}</p>
          <span className="badge">Coming soon</span>
        </article>
      ))}
    </section>
  );
}
