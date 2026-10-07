# Original prompt — Wobble Rush 3D

Build a complete browser-based 3D game inspired by Fall Guys-style obstacle courses, but with original characters, names, art, and level design. Call it "Wobble Rush 3D". Use Three.js with plain HTML, CSS, and JavaScript unless the existing project already has a framework.

Core game:
- Single-player 3D obstacle course.
- The player controls a simple rounded character running toward the finish line.
- Controls:
  - WASD or arrow keys to move.
  - Space to jump.
  - Shift to dive/boost forward briefly.
  - Third-person follow camera.
- The goal is to reach the finish as fast as possible.
- Include timer, checkpoint, restart, and finish screen.

Level design: Create one polished short course with:
- Starting platform.
- Rotating sweeper bars the player must jump over.
- Moving platforms.
- Bouncing bumpers.
- A narrow bridge section.
- A final ramp or gate into the finish zone.
- Falling off the course respawns the player at the latest checkpoint.

Visual style:
- Bright, colorful, toy-like 3D.
- Glossy platforms, chunky shapes, satisfying motion.
- Use original colors and shapes. Do not copy Fall Guys assets or characters.
- Add particles or small effects for landing, checkpoint, dive, respawn, and finish.
- Add simple animated background pieces so the scene feels alive.

Game feel:
- Movement must feel responsive and forgiving.
- Jumping should be easy to understand.
- Obstacles should be readable and fair.
- Falling should be quick to recover from.
- The game should feel arcade-like, not like a physics sim.

UI:
- Start screen with title and Play button.
- In-game HUD showing timer and checkpoint count.
- Finish screen showing completion time and Restart button.
- Compact, polished UI.

Code quality:
- Organize code into clear modules/classes: Game, Player, Course, Obstacle, Checkpoint, UI, Effects.
- No silent fallbacks. If Three.js or an asset fails to load, show a clear error.
- Keep the scope focused on one fun playable course.

Acceptance criteria:
- I can open the project in a browser and play immediately.
- The character can move, jump, dive, fall, respawn at checkpoints, and finish the course.
- Obstacles move and interact with the player.
- The scene is clearly 3D, colorful, animated, and polished.
- Restart works from both failure/respawn flow and finish screen.

Operational requirement: a `call-guys` folder.
