const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const sseClients = new Set();

function broadcastBuildEvent(payload) {
	const message = `event: built\ndata: ${JSON.stringify(payload)}\n\n`;
	for (const client of sseClients) {
		client.write(message);
	}
}

// Serve the output directory without caching so browser always fetches fresh files
app.use(
	'/output',
	express.static(path.join(__dirname, 'output'), {
		etag: false,
		lastModified: false,
		setHeaders: (res) => {
			res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
		}
	})
);

// Root serves an HTML wrapper that refreshes the SVG image every 250ms
app.get('/', (req, res) => {
	const svgUrl = '/output/points/demo.svg';
	const html = `<!doctype html>
<html>
	<head>
		<meta charset="utf-8">
		<title>Auto-reload SVG</title>
		<style>
			html,body{height:100%;margin:0;background:linear-gradient(180deg,#f4f6f8 0%,#eef2f6 100%);font-family:Arial,Helvetica,sans-serif;overflow:hidden}
			body{--gap:clamp(16px,2vw,28px);--panel-w:clamp(220px,24vw,360px);--panel-h:clamp(220px,30vh,360px);}
			.shell{display:grid;grid-template-rows:auto minmax(0,1fr);gap:14px;height:100%;padding:var(--gap);box-sizing:border-box}
			.toolbar{display:flex;align-items:center;justify-content:flex-start;min-height:42px}
			.switcher{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.9);border:1px solid rgba(148,163,184,0.35);border-radius:999px;padding:6px;box-shadow:0 8px 18px rgba(15,23,42,0.08)}
			.switcher .label{font-size:12px;font-weight:700;color:#334155;padding:0 6px 0 10px;letter-spacing:0.04em;text-transform:uppercase;cursor:pointer;user-select:none}
			.switcher button{appearance:none;border:0;background:transparent;color:#334155;border-radius:999px;padding:8px 12px;font-size:13px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease,transform .15s ease}
			.switcher button:hover{transform:translateY(-1px)}
			.switcher button[aria-pressed="true"]{background:#0f172a;color:#fff}
			.workspace{min-height:0;display:grid;gap:var(--gap);align-items:stretch}
			body[data-magnifier-position="right"] .workspace{grid-template-columns:minmax(0,1fr) var(--panel-w);grid-template-rows:minmax(0,1fr);grid-template-areas:"stage magnifier"}
			body[data-magnifier-position="top"] .workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:var(--panel-h) minmax(0,1fr);grid-template-areas:"magnifier" "stage"}
			body[data-magnifier-position="off"] .workspace{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr);grid-template-areas:"stage"}
			.stage{min-width:0;display:flex;align-items:center;justify-content:center}
			.stage{grid-area:stage}
			.card{background:#ffffff;padding:18px;border-radius:14px;box-shadow:0 10px 28px rgba(15,23,42,0.1);width:100%;height:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
			#preview{max-width:100%;max-height:100%;object-fit:contain;display:block;user-select:none;-webkit-user-drag:none;cursor:crosshair}
			.magnifier{min-width:0;background:rgba(255,255,255,0.92);backdrop-filter:blur(10px);border:1px solid rgba(148,163,184,0.35);border-radius:16px;box-shadow:0 14px 34px rgba(15,23,42,0.16);padding:12px;box-sizing:border-box;display:flex;flex-direction:column}
			.magnifier{grid-area:magnifier;min-height:0}
			body[data-magnifier-position="right"] .magnifier{width:100%;height:100%}
			body[data-magnifier-position="top"] .magnifier{width:100%;height:100%}
			body[data-magnifier-position="off"] .magnifier{display:none}
			.magnifier-body{display:flex;flex-direction:column;min-height:0;flex:1}
			.magnifier-title{display:flex;align-items:flex-start;justify-content:space-between;margin:0 0 10px;color:#0f172a;gap:12px}
			.magnifier-title-main{display:flex;flex-direction:column;gap:4px;min-width:0}
			.magnifier-title-label{font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase}
			.magnifier-title-point{font-size:15px;font-weight:700;line-height:1.15;word-break:break-word}
			.magnifier-title-stats{font-size:12px;color:#475569;line-height:1.35;text-align:right;font-variant-numeric:tabular-nums}
			.magnifier-view{position:relative;width:100%;flex:1;min-height:0;border-radius:12px;background:#e2e8f0 center center / 100% 100% no-repeat;overflow:hidden;border:1px solid rgba(148,163,184,0.25);cursor:crosshair}
			.magnifier-view::after{content:'';position:absolute;inset:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.35);border-radius:inherit;pointer-events:none}
			.cursor-indicator{position:absolute;left:0;top:0;width:14px;height:14px;transform:translate(-50%,-50%);pointer-events:none;opacity:0;transition:opacity .08s ease}
			.cursor-indicator::before,.cursor-indicator::after{content:'';position:absolute;left:50%;top:50%;background:rgba(15,23,42,0.95);border-radius:999px;transform:translate(-50%,-50%)}
			.cursor-indicator::before{width:14px;height:1.5px}
			.cursor-indicator::after{width:1.5px;height:14px}
			.controls{margin-top:10px}
			.controls label{display:block;margin:0 0 6px;color:#334155;font-size:12px;font-weight:700}
			.controls-row{display:flex;align-items:center;gap:10px}
			#zoomRange{width:100%;accent-color:#0f172a}
			#zoomValue{min-width:44px;text-align:right;color:#0f172a;font-size:12px;font-variant-numeric:tabular-nums}
			@media (max-width:900px){body{--panel-w:clamp(200px,30vw,320px)}}
			@media (max-width:700px){
				.shell{gap:12px}
				.toolbar{min-height:38px}
				body[data-magnifier-position="right"] .workspace,
				body[data-magnifier-position="top"] .workspace{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);grid-template-areas:"magnifier" "stage"}
				.card{border-radius:12px;padding:12px}
				.magnifier{width:100%;height:auto;padding:10px;border-radius:14px}
			}
		</style>
		<script>
			document.addEventListener('DOMContentLoaded', () => {
				const baseUrl = ${JSON.stringify(svgUrl)};
				const preview = document.getElementById('preview');
				const magnifier = document.getElementById('magnifier');
				const magnifierView = document.querySelector('.magnifier-view');
				const cursorIndicator = document.querySelector('.cursor-indicator');
				const titlePoint = document.querySelector('.magnifier-title-point');
				const titleStats = document.querySelector('.magnifier-title-stats');
				const zoomRange = document.getElementById('zoomRange');
				const zoomValue = document.getElementById('zoomValue');
				const modeButtons = Array.from(document.querySelectorAll('[data-position]'));

				let currentUrl = '';
				let lastPointer = null;
				let storedPoints = [];
				let eventSource = null;
				let magnifierPosition = localStorage.getItem('magnifierPosition') || 'right';
				let pointCounter = 0;

				function applyMagnifierPosition(position) {
					magnifierPosition = position === 'top' ? 'top' : position === 'off' ? 'off' : 'right';
					document.body.dataset.magnifierPosition = magnifierPosition;
					modeButtons.forEach((button) => {
						button.setAttribute('aria-pressed', button.dataset.position === magnifierPosition ? 'true' : 'false');
					});
					localStorage.setItem('magnifierPosition', magnifierPosition);
				}

				function toggleMagnifierFromSvg() {
					applyMagnifierPosition(magnifierPosition === 'off' ? 'top' : 'off');
				}

				function refreshImage() {
					currentUrl = baseUrl + '?ts=' + Date.now();
					preview.src = currentUrl;
					magnifierView.style.backgroundImage = 'url("' + currentUrl + '")';
				}

				function getPointFromClient(clientX, clientY) {
					const drawn = getDrawnRect(preview);
					const inside = clientX >= drawn.left && clientX <= drawn.left + drawn.width && clientY >= drawn.top && clientY <= drawn.top + drawn.height;

					if (!inside) {
						return null;
					}

					const x = ((clientX - drawn.left) / drawn.width) * preview.naturalWidth;
					const y = ((clientY - drawn.top) / drawn.height) * preview.naturalHeight;

					return { x, y, drawn };
				}

				function updatePointHeader() {
					if (!storedPoints.length) {
						titlePoint.textContent = 'Nothing stored yet';
						titleStats.textContent = 'Press Space to store the current crosshair position';
						return;
					}

					const current = storedPoints[storedPoints.length - 1];
					const previous = storedPoints.length > 1 ? storedPoints[storedPoints.length - 2] : null;
					const dx = previous ? current.x - previous.x : 0;
					const dy = previous ? current.y - previous.y : 0;
					const distance = previous ? Math.hypot(dx, dy) : 0;

					titlePoint.textContent = current.label + ': x ' + current.x.toFixed(2) + '  y ' + current.y.toFixed(2);
					titleStats.textContent = 'dx ' + dx.toFixed(2) + '  dy ' + dy.toFixed(2) + '  dist ' + distance.toFixed(2);
				}

				function storeCurrentPoint() {
					if (!lastPointer) {
						return;
					}

					const point = getPointFromClient(lastPointer.x, lastPointer.y);
					if (!point) {
						return;
					}

					pointCounter += 1;
					storedPoints.push({
						label: 'P' + pointCounter,
						x: point.x,
						y: point.y
					});
					updatePointHeader();
				}

				function getDrawnRect(img) {
					const box = img.getBoundingClientRect();
					const naturalWidth = img.naturalWidth || box.width || 1;
					const naturalHeight = img.naturalHeight || box.height || 1;
					const imageRatio = naturalWidth / naturalHeight;
					const boxRatio = box.width / box.height;
					let drawWidth = box.width;
					let drawHeight = box.height;
					let offsetX = 0;
					let offsetY = 0;

					if (boxRatio > imageRatio) {
						drawWidth = box.height * imageRatio;
						offsetX = (box.width - drawWidth) / 2;
					} else {
						drawHeight = box.width / imageRatio;
						offsetY = (box.height - drawHeight) / 2;
					}

					return {
						left: box.left + offsetX,
						top: box.top + offsetY,
						width: drawWidth,
						height: drawHeight
					};
				}

				function updateMagnifierFromPoint(clientX, clientY) {
					const zoom = Number(zoomRange.value);
					zoomValue.textContent = zoom.toFixed(1) + 'x';

					if (!preview.complete || !preview.naturalWidth || !preview.naturalHeight) {
						return;
					}

					const point = getPointFromClient(clientX, clientY);
					if (!point) {
						magnifier.style.backgroundPosition = 'center center';
						magnifier.style.opacity = '0.55';
						cursorIndicator.style.opacity = '0';
						return;
					}

					const drawn = point.drawn;
					const localX = clientX - drawn.left;
					const localY = clientY - drawn.top;
					const magBox = magnifierView.getBoundingClientRect();
					const backgroundWidth = drawn.width * zoom;
					const backgroundHeight = drawn.height * zoom;

					magnifier.style.opacity = '1';
					magnifierView.style.backgroundSize = backgroundWidth + 'px ' + backgroundHeight + 'px';
					magnifierView.style.backgroundPosition = (-(localX * zoom - magBox.width / 2)) + 'px ' + (-(localY * zoom - magBox.height / 2)) + 'px';
					cursorIndicator.style.opacity = '1';
					cursorIndicator.style.left = (magBox.width / 2) + 'px';
					cursorIndicator.style.top = (magBox.height / 2) + 'px';
				}

				function adjustZoom(delta) {
					const currentZoom = Number(zoomRange.value);
					const nextZoom = Math.min(Number(zoomRange.max), Math.max(Number(zoomRange.min), currentZoom + delta));
					zoomRange.value = nextZoom.toFixed(1);
					zoomValue.textContent = nextZoom.toFixed(1) + 'x';
					zoomRange.dispatchEvent(new Event('input', { bubbles: true }));
				}

				preview.addEventListener('pointermove', (event) => {
					lastPointer = { x: event.clientX, y: event.clientY };
					preview.style.cursor = 'crosshair';
					magnifierView.style.cursor = 'crosshair';
					updateMagnifierFromPoint(event.clientX, event.clientY);
				});

				preview.addEventListener('pointerleave', () => {
					magnifier.style.opacity = '0.72';
					cursorIndicator.style.opacity = '0';
				});

				preview.addEventListener('click', (event) => {
					if (event.button === 0) {
						toggleMagnifierFromSvg();
					}
				});

				document.addEventListener('keydown', (event) => {
					if (event.code === 'Space' && !event.repeat) {
						event.preventDefault();
						storeCurrentPoint();
					}
				});

				preview.addEventListener('wheel', (event) => {
					event.preventDefault();
					const step = event.deltaY > 0 ? -0.5 : 0.5;
					adjustZoom(step);
				}, { passive: false });

				magnifier.addEventListener('wheel', (event) => {
					event.preventDefault();
					const step = event.deltaY > 0 ? -0.5 : 0.5;
					adjustZoom(step);
				});

				zoomRange.addEventListener('input', () => {
					zoomValue.textContent = Number(zoomRange.value).toFixed(1) + 'x';
					if (lastPointer) {
						updateMagnifierFromPoint(lastPointer.x, lastPointer.y);
					}
				});

				modeButtons.forEach((button) => {
					button.addEventListener('click', () => applyMagnifierPosition(button.dataset.position));
				});

				applyMagnifierPosition(magnifierPosition);
				updatePointHeader();

				refreshImage();
				eventSource = new EventSource('/events');
				eventSource.addEventListener('built', () => {
					refreshImage();
					if (lastPointer) {
						updateMagnifierFromPoint(lastPointer.x, lastPointer.y);
					}
				});
				eventSource.onerror = () => {
					console.warn('Build event stream disconnected; preview will not refresh until the connection returns.');
				};
			});
		</script>
	</head>
	<body>
		<div class="shell">
			<div class="toolbar">
				<div class="switcher" role="group" aria-label="Magnifier position">
					<span class="label">Magnifier</span>
					<button type="button" data-position="off" aria-pressed="false">Off</button>
					<button type="button" data-position="right" aria-pressed="true">Side</button>
					<button type="button" data-position="top" aria-pressed="false">Top</button>
				</div>
			</div>
			<div class="workspace">
				<div class="stage">
					<div class="card">
						<img id="preview" src="${svgUrl}?ts=${Date.now()}" alt="demo svg">
					</div>
				</div>
				<aside id="magnifier" class="magnifier" aria-label="Zoomed preview">
					<div class="magnifier-body">
						<div class="magnifier-title">
							<div class="magnifier-title-main">
								<div class="magnifier-title-label">MAGNIFIER</div>
								<div class="magnifier-title-point">Nothing stored yet</div>
							</div>
							<div class="magnifier-title-stats">Press Space to store the current crosshair position</div>
						</div>
						<div class="magnifier-title" style="margin-top:-2px;margin-bottom:10px;">
							<div class="magnifier-title-main">
								<div class="magnifier-title-label">Zoom</div>
							</div>
							<div id="zoomValue">2.0x</div>
						</div>
						<div class="magnifier-view"><div class="cursor-indicator" aria-hidden="true"></div></div>
						<div class="controls">
							<label for="zoomRange">Magnification</label>
							<div class="controls-row">
								<input id="zoomRange" type="range" min="1.0" max="15.0" value="2.0" step="0.1">
							</div>
						</div>
					</div>
				</aside>
			</div>
		</div>
	</body>
</html>`;
	res.send(html);
});

app.get('/events', (req, res) => {
	res.setHeader('Content-Type', 'text/event-stream');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.flushHeaders?.();
	res.write(': connected\n\n');

	sseClients.add(res);

	req.on('close', () => {
		sseClients.delete(res);
	});
});

app.listen(PORT, () => {
	console.log(`Server running at http://localhost:${PORT}`);

	// Optional: run a shell command whenever config.yaml changes.
	// Configure via environment variable `RELOAD_CMD` (string).
	const { exec } = require('child_process');
	const reloadCmd = process.env.RELOAD_CMD || 'ergogen config.yaml';
	const configPath = path.join(__dirname, 'config.yaml');

	let running = false;
	let queued = false;
	let watcherStarted = false;

	function runReloadCommand(reason) {
		if (!reloadCmd) {
			return;
		}
		if (running) {
			queued = true;
			console.log(`Reload command already running; queued another run (${reason})`);
			return;
		}

		running = true;
		console.log(`Running reload command (${reason}): ${reloadCmd}`);
		exec(reloadCmd, { cwd: __dirname }, (err, stdout, stderr) => {
			running = false;
			if (err) {
				console.error('Reload command failed:', err.message || err);
			}
			if (stdout) process.stdout.write(stdout);
			if (stderr) process.stderr.write(stderr);
			broadcastBuildEvent({ reason, ok: !err, timestamp: Date.now() });

			if (queued) {
				queued = false;
				runReloadCommand('queued change');
			}
		});
	}

	if (reloadCmd) {
		console.log(`Watching ${configPath} and running: ${reloadCmd}`);
		runReloadCommand('startup');
		fs.watchFile(configPath, { interval: 250 }, (current, previous) => {
			if (current.mtimeMs !== previous.mtimeMs) {
				runReloadCommand('config.yaml changed');
			}
		});
		watcherStarted = true;
	}

	process.on('exit', () => {
		if (watcherStarted) {
			fs.unwatchFile(configPath);
		}
	});
});