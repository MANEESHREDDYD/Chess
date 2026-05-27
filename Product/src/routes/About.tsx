export default function About() {
  return (
    <div className="about">
      <h1>About MIRROR</h1>

      <p>
        MIRROR is an open chess experiment. The goal is to test whether a chess opponent calibrated
        to your specific style feels meaningfully like you. This is the Stage 0 prototype — bare
        bones, no story, no theme.
      </p>

      <h2>Credits &amp; open-source attribution</h2>

      <h3>Stockfish</h3>
      <p>
        This product uses the Stockfish chess engine, licensed under the GNU General Public License
        v3 (GPLv3). Stockfish is loaded as a separate Web Worker module and called via the UCI
        protocol; the rest of this application is independent code.
      </p>
      <ul>
        <li>
          Source:{' '}
          <a
            href="https://github.com/official-stockfish/Stockfish"
            target="_blank"
            rel="noreferrer"
          >
            github.com/official-stockfish/Stockfish
          </a>
        </li>
        <li>
          License:{' '}
          <a href="https://www.gnu.org/licenses/gpl-3.0.html" target="_blank" rel="noreferrer">
            GPLv3
          </a>
        </li>
      </ul>

      <h3>chess.js</h3>
      <p>
        Move generation, validation, and PGN handling by chess.js (BSD-2-Clause).{' '}
        <a href="https://github.com/jhlywa/chess.js" target="_blank" rel="noreferrer">
          github.com/jhlywa/chess.js
        </a>
      </p>

      <h3>react-chessboard</h3>
      <p>
        Board rendering by react-chessboard (MIT).{' '}
        <a href="https://github.com/Clariity/react-chessboard" target="_blank" rel="noreferrer">
          github.com/Clariity/react-chessboard
        </a>
      </p>

      <h2>This project</h2>
      <p>
        MIRROR is licensed under the GNU Affero General Public License v3 (AGPLv3). Source code:{' '}
        <a href="https://github.com/MANEESHREDDYD/Chess" target="_blank" rel="noreferrer">
          github.com/MANEESHREDDYD/Chess
        </a>
        .
      </p>

      <h2>Privacy</h2>
      <p>
        We don't track you. We don't set advertising cookies. Games are stored in your browser.
        Optional email submission for the beta cohort is the only data that leaves your device,
        and only if you opt in.
      </p>
    </div>
  );
}
