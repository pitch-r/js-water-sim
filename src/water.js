{
    // Configuration
    const grid_size = { w: 320, h: 240 }; // w*h
    let boundary_type = {
        circle: false,
        top: "matched",
        bottom: "matched",
        left: "free",
        right: "free",
    };
    let enable_rain = true;
    const velo = 0.7; // wave propagation in cell per timestep [ must <1 ]
    const timestep_per_frame = 3;

    // Utility functions (mem & math)
    function pow2(x) { return x * x; }
    function dist2(x, y) { return x * x + y * y; }
    function clamp(x, min, max) { return x < min ? min : (x > max ? max : x); }
    function split_subarray(arr, chunk) {
        let o = [];
        for (let i = 0; i < arr.length; i += chunk)
            o.push(arr.subarray(i, i + chunk));
        return o;
    }

    // Simulation state variables
    let grid = {
        h_data: new Float32Array(grid_size.w * grid_size.h), // water delta-height
        u_data: new Float32Array(grid_size.w * grid_size.h), // h changing velocity
        hn_data: new Float32Array(grid_size.w * grid_size.h), // for double buffering h
    };
    // Map into easier to access 2d array
    grid.h = split_subarray(grid.h_data, grid_size.w);
    grid.u = split_subarray(grid.u_data, grid_size.w);
    grid.hn = split_subarray(grid.hn_data, grid_size.w);

    // Simulation code
    function timestep() {
        if (boundary_type.circle) {
            // Circlular Boundary
            const rad = pow2(grid_size.h / 2);
            for (let y = 0; y < grid_size.h; y++) {
                for (let x = 0; x < grid_size.w; x++) {
                    if (dist2(x - grid_size.w * 0.5, y - grid_size.h * 0.5) >= rad) {
                        grid.h[y][x] = 0;
                        grid.u[y][x] = 0;
                    }
                }
            }
        } else {
            // Open/Free boundary condition
            if (boundary_type.left == 'free')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.h[y][0] = grid.h[y][1];
            if (boundary_type.right == 'free')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.h[y][grid_size.w - 1] = grid.h[y][grid_size.w - 2];
            if (boundary_type.top == 'free')
                for (let x = 1; x < grid_size.w - 1; x++)
                    grid.h[0].set(grid.h[1]);
            if (boundary_type.bottom == 'free')
                for (let x = 1; x < grid_size.w - 1; x++)
                    grid.h[grid_size.h - 1].set(grid.h[grid_size.h - 2]);

            // Closed boundary condition
            if (boundary_type.left == 'closed')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.h[y][0] = 0;
            if (boundary_type.right == 'closed')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.h[y][grid_size.w - 1] = 0;
            if (boundary_type.top == 'closed')
                grid.h[0].fill(0);
            if (boundary_type.bottom == 'closed')
                grid.h[grid_size.h - 1].fill(0);
        }

        for (let y = 1; y < grid_size.h - 1; y++) {
            for (let x = 1; x < grid_size.w - 1; x++) {
                let delta = (velo * velo) * (
                    grid.h[y - 1][x] +
                    grid.h[y][x - 1] +
                    grid.h[y][x + 1] +
                    grid.h[y + 1][x] -
                    grid.h[y][x] * 4);
                grid.u[y][x] = grid.u[y][x] * 0.997 + delta;
                grid.hn[y][x] = grid.h[y][x] * 0.997 + grid.u[y][x];
            }
        }

        if (!boundary_type.circle) {
            // Matched boundary condition
            const ratio = velo * 4;
            const _vdiv = 1 / (1 + ratio);
            if (boundary_type.left == 'matched')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.hn[y][0] = (grid.h[y][0] + ratio * grid.h[y][1]) * _vdiv;
            if (boundary_type.right == 'matched')
                for (let y = 1; y < grid_size.h - 1; y++)
                    grid.hn[y][grid_size.w - 1] = (grid.h[y][grid_size.w - 1] + ratio * grid.h[y][grid_size.w - 2]) * _vdiv;
            if (boundary_type.top == 'matched')
                for (let x = 1; x < grid_size.w - 1; x++)
                    grid.hn[0][x] = (grid.h[0][x] + ratio * grid.h[1][x]) * _vdiv;
            if (boundary_type.bottom == 'matched')
                for (let x = 1; x < grid_size.w - 1; x++)
                    grid.hn[grid_size.h - 1][x] = (grid.h[grid_size.h - 1][x] + ratio * grid.h[grid_size.h - 2][x]) * _vdiv;
        }

        // Swap buffer
        [grid.h, grid.hn] = [grid.hn, grid.h];
        [grid.h_data, grid.hn_data] = [grid.hn_data, grid.h_data];

        add_external_force();
    }

    // Rendering code

    const canvas_data = document.getElementById("canvas-data");
    const canvas_slice = document.getElementById("canvas-slice");
    const canvas_refrac = document.getElementById("canvas-refrac");

    let crefrac_bg = undefined;
    let crefrac_bg_small = undefined; // Downscaled image fit for refrac canvas
    {
        // Refraction background image load / cache
        let img = document.getElementById('refrac-bg');
        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = grid_size.w;
            canvas.height = grid_size.h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, grid_size.w, grid_size.h);
            crefrac_bg = ctx.getImageData(0, 0, grid_size.w, grid_size.h).data;

            const cw = canvas_refrac.width;
            const ch = canvas_refrac.height;
            canvas.width = cw;
            canvas.height = ch;
            ctx.drawImage(img, 0, 0, cw, ch);
            crefrac_bg_small = ctx.getImageData(0, 0, cw, ch).data;
        };
        if (img.complete)
            img.onload();
    }

    let cdata_buf = canvas_data.getContext('2d').createImageData(grid_size.w, grid_size.h);
    cdata_buf.data.fill(255);
    let crefrac_buf = canvas_refrac.getContext('2d').createImageData(canvas_refrac.width, canvas_refrac.height);
    crefrac_buf.data.fill(255);
    function draw(fps) {
        { // Data view
            const ctx = canvas_data.getContext('2d');
            for (let i = 0; i < grid.h_data.length; i++) {
                cdata_buf.data.fill((grid.h_data[i] * 100 + 128) | 0, i * 4, i * 4 + 3);
            }
            ctx.putImageData(cdata_buf, 0, 0);

            // Draw FPS
            ctx.font = '12px sans-serif';
            ctx.fillText(fps.toFixed(0), 5, 12);

            // Draw boundary
            if (boundary_type.circle) {
                ctx.strokeStyle = "#F00";
                ctx.beginPath();
                ctx.arc(grid_size.w / 2, grid_size.h / 2, grid_size.h / 2, 0, Math.PI * 2, true);
                ctx.stroke();
            } else {
                ctx.fillStyle = "#F00";
                if (boundary_type.top != 'matched')
                    ctx.fillRect(0, 0, grid_size.w, 2);
                if (boundary_type.bottom != 'matched')
                    ctx.fillRect(0, grid_size.h - 2, grid_size.w, 2);
                if (boundary_type.left != 'matched')
                    ctx.fillRect(0, 0, 2, grid_size.h);
                if (boundary_type.right != 'matched')
                    ctx.fillRect(grid_size.w - 2, 0, 2, grid_size.h);
            }
        }
        { // Cross-section view (slice)
            const cw = canvas_slice.width;
            const ch = canvas_slice.height;
            const ctx = canvas_slice.getContext('2d');
            ctx.clearRect(0, 0, cw, ch);
            ctx.fillStyle = "#000";

            let slices = grid.h[grid_size.h / 2 | 0];
            for (let i = 0; i < slices.length; i++) {
                let d = ch * (0.5 - slices[i] * 0.2);
                d = clamp(d, 0, ch - 1) | 0;
                ctx.fillRect(i, d, 1, ch - d);
            }
        }
        if (crefrac_bg) { // Refraction + Reflection
            const cw = canvas_refrac.width;
            const ch = canvas_refrac.height;
            const ctx = canvas_refrac.getContext('2d');

            // Prepare canvas with undistorted bg
            crefrac_buf.data.set(crefrac_bg_small);
            // crefrac_buf.data.fill(255);
            for (let y = 1; y < ch - 1; y++) {
                const yy = y * 2;
                for (let x = 1; x < cw - 1; x++) {
                    const xx = x * 2;
                    let dx = grid.h[yy][xx + 1] - grid.h[yy][xx - 1];
                    let dy = grid.h[yy + 1][xx] - grid.h[yy - 1][xx];
                    // normalize
                    const dist = dist2(dx, dy);
                    if (dist < 0.000625) { // threshold =  pow2(1/20/2)
                        continue;
                    }
                    const norm = Math.sqrt(dist + 1);
                    const normmag = 20 / norm;
                    dx *= normmag; dy *= normmag;
                    const srcx = clamp(Math.round(xx + dx), 0, grid_size.w - 1);
                    const srcy = clamp(Math.round(yy + dy), 0, grid_size.h - 1);
                    const src_offset = (srcy * grid_size.w + srcx) * 4;
                    let rgb = crefrac_bg.slice(src_offset, src_offset + 3);
                    const factor = 1 - Math.min(0.5, 3 * (norm - 1));
                    rgb[0] *= factor;
                    rgb[1] *= factor;
                    rgb[2] *= factor;
                    if (dx > 1) {
                        rgb[0] += 30;
                        rgb[1] += 30;
                        rgb[2] += 30;
                    }
                    crefrac_buf.data.set(rgb, (y * cw + x) * 4);
                }
            }
            ctx.putImageData(crefrac_buf, 0, 0);

            // Draw boundary
            if (boundary_type.circle) {
                ctx.strokeStyle = "#F00";
                ctx.beginPath();
                ctx.arc(cw / 2, ch / 2, ch / 2, 0, Math.PI * 2, true);
                ctx.stroke();
            } else {
                ctx.fillStyle = "#F00";
                if (boundary_type.top != 'matched')
                    ctx.fillRect(0, 0, cw, 1);
                if (boundary_type.bottom != 'matched')
                    ctx.fillRect(0, ch - 1, cw, 1);
                if (boundary_type.left != 'matched')
                    ctx.fillRect(0, 0, 1, ch);
                if (boundary_type.right != 'matched')
                    ctx.fillRect(cw - 1, 0, 1, ch);
            }
        }
    }

    // Event Listeners

    let mouse = {
        pressed: false,
        x: 0,
        y: 0,
    };

    function handleMouseEvent(event) {
        mouse.pressed = !!(event.buttons & 1);
        if (mouse.pressed) {
            mouse.x = event.offsetX * grid_size.w / event.target.clientWidth;
            mouse.y = event.offsetY * grid_size.h / event.target.clientHeight;
        }
        event.preventDefault();
    }
    function handleTouchEvent(event) {
        if (event.targetTouches.length) {
            mouse.pressed = true;
            let t = event.targetTouches[0];
            var bcr = event.target.getBoundingClientRect();
            mouse.x = (t.clientX - bcr.x) * grid_size.w / bcr.width;
            mouse.y = (t.clientY - bcr.y) * grid_size.h / bcr.height;
        } else {
            mouse.pressed = false;
        }
        event.preventDefault();
    }
    canvas_data.addEventListener('mousedown', handleMouseEvent);
    canvas_data.addEventListener('mouseup', handleMouseEvent);
    canvas_data.addEventListener('mousemove', handleMouseEvent);
    canvas_data.addEventListener('touchstart', handleTouchEvent);
    canvas_data.addEventListener('touchend', handleTouchEvent);
    canvas_data.addEventListener('touchmove', handleTouchEvent);
    canvas_refrac.addEventListener('mousedown', handleMouseEvent);
    canvas_refrac.addEventListener('mouseup', handleMouseEvent);
    canvas_refrac.addEventListener('mousemove', handleMouseEvent);
    canvas_refrac.addEventListener('touchstart', handleTouchEvent);
    canvas_refrac.addEventListener('touchend', handleTouchEvent);
    canvas_refrac.addEventListener('touchmove', handleTouchEvent);

    function updateConfig() {
        const getChecked = (id) => document.getElementById(id).checked;
        const getRadioValue = (name) => {
            for (let e of document.getElementsByName(name))
                if (e.checked) return e.value;
        };
        boundary_type.circle = getChecked("circle-border");
        boundary_type.top = getRadioValue("border-top");
        boundary_type.bottom = getRadioValue("border-bottom");
        boundary_type.left = getRadioValue("border-left");
        boundary_type.right = getRadioValue("border-right");
        enable_rain = getChecked("enable-rain");
    }
    document.querySelectorAll("input").forEach(
        (e) => e.addEventListener("change", updateConfig)
    );
    updateConfig();

    // Add value to simulation grid in circular shape
    function paint_grid(grid_var, tx, ty, brush_size, power) {
        const brush2 = pow2(brush_size);
        const bound = {
            x1: Math.max(Math.round(tx - brush_size), 1),
            x2: Math.min(Math.round(tx + brush_size), grid_size.w - 2),
            y1: Math.max(Math.round(ty - brush_size), 1),
            y2: Math.min(Math.round(ty + brush_size), grid_size.h - 2),
        };
        for (let y = bound.y1; y <= bound.y2; y++) {
            for (let x = bound.x1; x <= bound.x2; x++) {
                if (dist2(x - tx, y - ty) < brush2)
                    grid_var[y][x] += power;
            }
        }
    }

    let frame = 0;
    function add_external_force() {
        // Called every timestep
        frame++;
        if (mouse.pressed) {
            paint_grid(grid.h, mouse.x, mouse.y, 5, 0.3);
        } else {
            if (enable_rain && frame % 60 == 0) {
                for (let i = (Math.random() * 2.9) | 0; i; i--) {
                    let tx = Math.random() * (grid_size.w - 2) + 1;
                    let ty = Math.random() * (grid_size.h - 2) + 1;
                    paint_grid(grid.h, tx, ty, 3, 1);
                }
            }
        }
    }

    let lasttimestamp = undefined;
    let fps_smooth = undefined;

    // Main loop
    function update(timestamp) {
        for (let repeat = timestep_per_frame; repeat > 0; repeat--)
            timestep();

        let fps = lasttimestamp ? 1000 / (timestamp - lasttimestamp) : 0;
        fps_smooth = (fps_smooth || fps) * 0.9 + fps * 0.1;
        draw(fps_smooth);
        lasttimestamp = timestamp;
        window.requestAnimationFrame(update);
    }
    update();
}
