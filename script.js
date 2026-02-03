// Simple Pong game
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const playerScoreEl = document.getElementById('playerScore');
  const computerScoreEl = document.getElementById('computerScore');
  const startBtn = document.getElementById('startBtn');
  const soundToggle = document.getElementById('soundToggle');

  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;

  // Game objects
  const paddleWidth = 12;
  const paddleHeight = 90;
  const paddleSpeed = 6; // for keyboard movement
  const aiMaxSpeed = 4.2;

  const player = {
    x: 10,
    y: (HEIGHT - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight
  };

  const computer = {
    x: WIDTH - paddleWidth - 10,
    y: (HEIGHT - paddleHeight) / 2,
    width: paddleWidth,
    height: paddleHeight
  };

  const ballRadius = 8;
  let ball = resetBall();

  let playerScore = 0;
  let computerScore = 0;

  let running = false;

  // Input state
  const keys = { ArrowUp: false, ArrowDown: false };
  let mouseY = null;

  // Sounds (optional, tiny)
  const sounds = {
    wall: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='), // tiny silent
    paddle: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA='),
    score: new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=')
  };

  function playSound(s) {
    try {
      if (!soundToggle.checked) return;
      s.currentTime = 0;
      s.play();
    } catch (e) { /* ignore */ }
  }

  function resetBall(servingTo = null) {
    // center ball, random direction
    const speed = 4;
    const angle = (Math.random() * Math.PI / 3) - (Math.PI / 6); // -30deg..30deg
    const dir = servingTo === 'player' ? -1 : servingTo === 'computer' ? 1 : (Math.random() < 0.5 ? -1 : 1);
    return {
      x: WIDTH / 2,
      y: HEIGHT / 2,
      vx: dir * speed * Math.cos(angle),
      vy: speed * Math.sin(angle),
      radius: ballRadius
    };
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // Input handling
  window.addEventListener('keydown', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = true;
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      keys[e.key] = false;
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    mouseY = y;
  });

  canvas.addEventListener('mouseleave', () => {
    mouseY = null;
  });

  startBtn.addEventListener('click', () => {
    startGame();
  });

  function startGame() {
    playerScore = 0;
    computerScore = 0;
    updateScoreUI();
    ball = resetBall();
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  // Game loop
  let lastTime = performance.now();
  function loop(now) {
    const dt = Math.min(30, now - lastTime); // ms capped for stability
    lastTime = now;
    if (running) {
      update(dt / 16.666); // normalize to ~60fps units
      draw();
      requestAnimationFrame(loop);
    } else {
      draw(); // still draw once if paused
    }
  }

  function update(scale) {
    // Player paddle: mouse has priority; arrow keys also work
    if (mouseY !== null) {
      // center paddle on mouse y
      player.y = clamp(mouseY - player.height / 2, 0, HEIGHT - player.height);
    } else {
      // keyboard movement
      if (keys.ArrowUp) player.y -= paddleSpeed * scale;
      if (keys.ArrowDown) player.y += paddleSpeed * scale;
      player.y = clamp(player.y, 0, HEIGHT - player.height);
    }

    // Computer AI: move toward ball center with limited speed
    const targetY = ball.y - computer.height / 2;
    const diff = targetY - computer.y;
    const move = clamp(diff, -aiMaxSpeed * scale, aiMaxSpeed * scale);
    computer.y += move;
    computer.y = clamp(computer.y, 0, HEIGHT - computer.height);

    // Ball movement
    ball.x += ball.vx * scale;
    ball.y += ball.vy * scale;

    // Collide with top/bottom walls
    if (ball.y - ball.radius <= 0) {
      ball.y = ball.radius;
      ball.vy *= -1;
      playSound(sounds.wall);
    } else if (ball.y + ball.radius >= HEIGHT) {
      ball.y = HEIGHT - ball.radius;
      ball.vy *= -1;
      playSound(sounds.wall);
    }

    // Check paddle collisions
    // Left paddle
    if (ball.x - ball.radius <= player.x + player.width) {
      if (ball.y >= player.y && ball.y <= player.y + player.height) {
        // collision
        ball.x = player.x + player.width + ball.radius; // prevent sticking
        reflectFromPaddle(player);
        playSound(sounds.paddle);
      }
    }

    // Right paddle
    if (ball.x + ball.radius >= computer.x) {
      if (ball.y >= computer.y && ball.y <= computer.y + computer.height) {
        ball.x = computer.x - ball.radius;
        reflectFromPaddle(computer);
        playSound(sounds.paddle);
      }
    }

    // Score checks
    if (ball.x + ball.radius < 0) {
      // computer scores
      computerScore++;
      playSound(sounds.score);
      updateScoreUI();
      if (computerScore >= 10) {
        endGame('Computer');
        return;
      }
      ball = resetBall('computer'); // serve to computer (toward right)
    } else if (ball.x - ball.radius > WIDTH) {
      // player scores
      playerScore++;
      playSound(sounds.score);
      updateScoreUI();
      if (playerScore >= 10) {
        endGame('Player');
        return;
      }
      ball = resetBall('player'); // serve to player (toward left)
    }
  }

  function reflectFromPaddle(paddle) {
    // Compute hit position relative to paddle center
    const paddleCenter = paddle.y + paddle.height / 2;
    const hitPos = (ball.y - paddleCenter) / (paddle.height / 2); // -1..1
    const maxBounceAngle = (5 * Math.PI) / 12; // ~75 deg
    const speed = Math.min(10, Math.hypot(ball.vx, ball.vy) + 0.6); // increase speed a bit
    const angle = hitPos * maxBounceAngle;
    const dir = paddle === player ? 1 : -1; // ball should go right if player hit, left if computer hit
    ball.vx = dir * speed * Math.cos(angle);
    ball.vy = speed * Math.sin(angle);
  }

  function updateScoreUI() {
    playerScoreEl.textContent = String(playerScore);
    computerScoreEl.textContent = String(computerScore);
  }

  function endGame(winner) {
    running = false;
    // simple alert for winner and instruct to restart
    setTimeout(() => {
      alert(`${winner} wins! Click "Start / Restart" to play again.`);
    }, 10);
  }

  // Drawing
  function draw() {
    // background
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    // subtle background grid / net
    ctx.fillStyle = '#0b1220';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // draw net
    ctx.fillStyle = '#1f2937';
    const netWidth = 4;
    for (let y = 10; y < HEIGHT; y += 20) {
      ctx.fillRect((WIDTH - netWidth) / 2, y, netWidth, 12);
    }

    // paddles
    drawRect(player.x, player.y, player.width, player.height, '#06b6d4');
    drawRect(computer.x, computer.y, computer.width, computer.height, '#a78bfa');

    // ball
    drawCircle(ball.x, ball.y, ball.radius, '#fef3c7');

    // scoreboard is handled in DOM
  }

  function drawRect(x, y, w, h, color) {
    ctx.fillStyle = color;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();
  }

  function drawCircle(x, y, r, color) {
    ctx.beginPath();
    ctx.fillStyle = color;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // helper to draw rounded rect
  function roundRect(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  // Start a first idle draw
  draw();

  // Auto-start when page loads for convenience
  // You can remove this to require pressing Start
  startGame();
})();
