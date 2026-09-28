/**
 * Starter programs. Opening one makes the student their own copy.
 * Add an example: drop a .py file in this folder and list it here.
 */
import guess from './guess_the_number.py?raw';
import bouncing from './bouncing_ball.py?raw';
import dodge from './dodge.py?raw';
import click from './click_the_target.py?raw';
import snake from './snake.py?raw';
import coins from './coin_collector.py?raw';
import { STARTER_GAME } from '../store/model.js';

export const EXAMPLES = [
  { id: 'blank-game', title: 'Blank game', level: 'Start here', uses: 'window · game loop',
    blurb: 'An empty pygame window with the game loop already written. Draw your game where the comment says.', code: STARTER_GAME },
  { id: 'guess-the-number', title: 'Guess the Number', level: 'Beginner', uses: 'input() · while · if/elif',
    blurb: 'A text game in the console. The computer picks a number; you guess it.', code: guess },
  { id: 'bouncing-ball', title: 'Bouncing Ball', level: 'Beginner', uses: 'animation · clock',
    blurb: 'The smallest animation there is: move, bounce off the walls, draw, repeat 60 times a second.', code: bouncing },
  { id: 'dodge', title: 'Dodge the Blocks', level: 'Intermediate', uses: 'keyboard · Rect · collisions',
    blurb: 'Hold the arrow keys to dodge falling blocks. It speeds up as your score climbs. R to restart.', code: dodge },
  { id: 'click-the-target', title: 'Click the Target', level: 'Intermediate', uses: 'mouse · timer · save file',
    blurb: 'Click the targets for 20 seconds. Your best score is saved to highscore.txt in the project.', code: click },
  { id: 'snake', title: 'Snake', level: 'Intermediate', uses: 'grid · lists · KEYDOWN',
    blurb: 'The classic. The snake is a list of squares; eating an apple keeps the tail.', code: snake },
  { id: 'coin-collector', title: 'Coin Collector', level: 'Advanced', uses: 'classes · sprites · groups',
    blurb: 'Everything is a Sprite class. Collect all the coins. Swap the drawn shapes for your own .png later.', code: coins },
  { id: 'hello', title: 'Plain Python', level: 'Start here', uses: 'print()',
    blurb: 'No game window — just Python. Good for warm-ups and practice problems.', code: 'print("Hello, HSCT!")\n' },
];
