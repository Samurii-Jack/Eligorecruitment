(function () {
    // --- 1. CONFIGURATION ---
    const SUPABASE_URL = "https://fjvtpaqopqrntbrxbqxg.supabase.co";
    const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdnRwYXFvcHFybnRicnhicXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzU0ODIsImV4cCI6MjA4NjkxMTQ4Mn0.R5ghQQfwla8-UgBNDBeTMEuRXEmPwO4wdkMt6iT-6gI";
    const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRl9nXfkHXdHiZ5OV-Kp8IMMNSp8-nYRUVkFf2Vu80FKaJzm97L7B-wD1USXaNvQnZHWKETjfLr7WeN/pub?gid=0&single=true&output=tsv";
    const WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/26573964/uc7noa6/";

    console.log('%cAdmin Portal Script Loading...', 'color: #c9a860; font-weight: bold;');

    // --- 2. INITIALIZATION ---
    let sbAdmin;
    try {
        if (!window.supabase) {
            throw new Error("Supabase library not loaded. Check script tag in admin.html.");
        }
        sbAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase initialized in portal.");
    } catch (e) {
        console.error("CRITICAL: Supabase failed to init:", e);
        alert("System Error: Supabase client failed to initialize. Please check console.");
    }

    // Global state
    let currentSection = 'applications';
    let cachedJobs = [];

    // DOM Elements
    console.log('Fetching DOM elements...');
    const dom = {
        loginScreen: document.getElementById('login-screen'),
        dashboard: document.getElementById('dashboard'),
        loginForm: document.getElementById('login-form'),
        loginEmail: document.getElementById('login-email'),
        loginPass: document.getElementById('login-password'),
        loginError: document.getElementById('login-error'),
        adminEmail: document.getElementById('admin-email'),
        logoutBtn: document.getElementById('logout-btn'),
        navItems: document.querySelectorAll('.nav-item[data-section]'),
        sections: document.querySelectorAll('.section-panel'),
        appTable: document.querySelector('#applications-table tbody'),
        msgTable: document.querySelector('#messages-table tbody'),
        jobsTable: document.querySelector('#jobs-table tbody'),
        postJobForm: document.getElementById('new-job-form')
    };

    // Check for missing elements
    Object.entries(dom).forEach(([key, val]) => {
        if (!val && key !== 'navItems' && key !== 'sections') {
            console.warn(`Warning: DOM element "${key}" not found!`);
        }
    });

    // --- 3. AUTH LOGIC ---

    async function checkAuth() {
        try {
            console.log('Checking session...');
            const { data: { session }, error } = await sbAdmin.auth.getSession();
            if (error) throw error;

            if (session) {
                console.log('Existing session found for:', session.user.email);
                showDashboard(session.user);
            } else {
                console.log('No existing session.');
                showLogin();
            }
        } catch (err) {
            console.error('Session check failed:', err);
            showLogin();
        }
    }

    function showDashboard(user) {
        console.log('Entering dashboard view...');
        dom.loginScreen.style.display = 'none';
        dom.dashboard.style.display = 'grid';
        dom.adminEmail.textContent = user.email;
        switchSection('applications');
    }

    function showLogin() {
        dom.loginScreen.style.display = 'flex';
        dom.dashboard.style.display = 'none';
    }

    if (dom.loginForm) {
        dom.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Login form submitted');

            dom.loginError.style.display = 'none';
            const btn = dom.loginForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Authenticating...';
            btn.disabled = true;

            const email = dom.loginEmail.value;
            const password = dom.loginPass.value;

            try {
                console.log('Attempting sign in for:', email);
                const { data, error } = await sbAdmin.auth.signInWithPassword({ email, password });

                if (error) {
                    console.error('Login error:', error);
                    dom.loginError.textContent = error.message;
                    dom.loginError.style.display = 'block';
                } else {
                    console.log('Login successful:', data.user.email);
                    showDashboard(data.user);
                }
            } catch (err) {
                console.error('Unexpected auth error:', err);
                dom.loginError.textContent = "Technical error: " + err.message;
                dom.loginError.style.display = 'block';
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    dom.logoutBtn.addEventListener('click', async () => {
        await sbAdmin.auth.signOut();
        showLogin();
    });

    // --- 4. NAVIGATION ---

    function switchSection(sectionId) {
        currentSection = sectionId;

        // Update Nav
        dom.navItems.forEach(item => {
            item.classList.toggle('active', item.dataset.section === sectionId);
        });

        // Update Panels
        dom.sections.forEach(panel => {
            panel.classList.toggle('active', panel.id === sectionId);
        });

        // Update Title
        const titles = {
            'applications': 'Applications',
            'messages': 'Messages',
            'jobs': 'Job Manager',
            'post-job': 'Post New Job'
        };
        document.getElementById('section-title').textContent = titles[sectionId];

        // Load Data
        if (sectionId === 'applications') loadApplications();
        if (sectionId === 'messages') loadMessages();
        if (sectionId === 'jobs') loadJobs();
    }

    dom.navItems.forEach(item => {
        item.addEventListener('click', () => switchSection(item.dataset.section));
    });

    // --- 5. DATA FETCHING & ACTIONS ---

    // APPLICATIONS
    async function loadApplications() {
        console.log('--- loadApplications triggered ---');
        dom.appTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading applications...</td></tr>';

        try {
            const { data, error } = await sbAdmin.from('applications').select('*').order('created_at', { ascending: false });

            if (error) {
                console.error('FETCH ERROR (apps):', error);
                dom.appTable.innerHTML = `<tr><td colspan="5" style="color:red; text-align:center;">Error: ${error.message}</td></tr>`;
                return;
            }

            console.log('APP DATA RECEIVED:', data);

            if (!data || data.length === 0) {
                console.warn('No applications visible.');
                dom.appTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">No applications found.</td></tr>';
                return;
            }

            dom.appTable.innerHTML = data.map(app => {
                const name = app.fullname || app.full_name || app.applicant_name || 'Unknown';
                const job = app.job_id || app.position || 'N/A';
                const cv = app.resume_url || app.cv_url || app.cv_path;

                return `
                    <tr>
                        <td>
                            <div style="font-weight:600;">${name}</div>
                            <div style="font-size:0.8rem; color:var(--text-light);">${app.email}</div>
                        </td>
                        <td>${job === 'undefined' ? 'N/A' : job}</td>
                        <td>${new Date(app.created_at).toLocaleDateString()}</td>
                        <td><span class="badge" style="background:rgba(201,168,96,0.1); color:var(--accent-gold);">Received</span></td>
                        <td>
                            ${cv ?
                        (cv.startsWith('http') ?
                            `<a href="${cv}" target="_blank" class="action-btn"><i class="fas fa-download"></i> View CV</a>` :
                            `<span title="${cv}" style="color:var(--accent-gold); font-size:0.8rem;"><i class="fas fa-file"></i> ${cv}</span>`
                        ) :
                        '<span style="color:var(--text-light);">No CV</span>'}
                        </td>
                    </tr>
                `;
            }).join('');
        } catch (e) {
            console.error('UI ERROR (apps):', e);
        }
    }

    // MESSAGES
    async function loadMessages() {
        console.log('--- loadMessages triggered ---');
        dom.msgTable.innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading messages...</td></tr>';

        try {
            console.log('Fetching "messages" from Supabase...');
            const { data, error } = await sbAdmin
                .from('messages')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('FETCH ERROR (messages):', error);
                dom.msgTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Permission or Database error: ${error.message}</td></tr>`;
                return;
            }

            console.log('MESSAGE DATA RECEIVED:', data);

            if (!data || data.length === 0) {
                console.warn('No messages returned. Check RLS policies if data exists in table.');
                dom.msgTable.innerHTML = '<tr><td colspan="4" style="text-align:center; opacity:0.7;">No messages visible. (Check RLS permissions)</td></tr>';
                return;
            }

            dom.msgTable.innerHTML = data.map(msg => `
                <tr>
                    <td>
                        <div style="font-weight:600;">${msg.name || 'Anonymous'}</div>
                        <div style="font-size:0.8rem; color:var(--text-light);">${msg.email || 'No email'}</div>
                    </td>
                    <td>${msg.subject || 'No Subject'}</td>
                    <td>${msg.created_at ? new Date(msg.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>
                        <button class="action-btn" onclick="alert('Message:\\n\\n${(msg.message || '').replace(/'/g, "\\'")}')">Read</button>
                    </td>
                </tr>
            `).join('');
            console.log('Table populated with', data.length, 'messages.');

        } catch (e) {
            console.error('CRITICAL UI ERROR:', e);
            dom.msgTable.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">System Error: ${e.message}</td></tr>`;
        }
    }

    async function loadJobs() {
        console.log('--- loadJobs triggered ---');
        dom.jobsTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading all jobs...</td></tr>';

        try {
            // 1. Fetch Supabase Jobs
            console.log('Fetching Supabase jobs...');
            const { data: dbJobs, error: dbError } = await sbAdmin.from('jobs').select('*').order('created_at', { ascending: false });
            if (dbError) console.error('Supabase jobs error:', dbError);
            console.log('SUPABASE JOBS RECEIVED:', dbJobs);

            // 2. Fetch Sheet Jobs
            console.log('Fetching Google Sheet jobs...');
            let sheetJobs = [];
            try {
                const res = await fetch(GOOGLE_SHEET_URL + '&cb=' + Date.now());
                const tsv = await res.text();
                sheetJobs = parseTSV(tsv).map(j => ({ ...j, source: 'Sheet' }));
                console.log('SHEET JOBS RECEIVED:', sheetJobs.length);
            } catch (e) {
                console.warn("Admin portal sheet fetch failed:", e);
            }

            const combined = [
                ...(dbJobs || []).map(j => ({ ...j, source: 'Supabase' })),
                ...sheetJobs
            ];
            console.log('COMBINED JOBS:', combined.length);

            if (combined.length === 0) {
                dom.jobsTable.innerHTML = '<tr><td colspan="5" style="text-align:center;">No jobs found.</td></tr>';
                return;
            }

            dom.jobsTable.innerHTML = combined.map((job, idx) => `
            <td>
                <div style="font-weight:600;">${job.job_title || job.title}</div>
                <div style="font-size:0.8rem; color:var(--text-light);">${job.company} • ${job.location}</div>
            </td>
            <td><span class="badge ${job.source === 'Supabase' ? 'badge-supabase' : 'badge-sheet'}">${job.source}</span></td>
            <td>${job.status || 'Active'}</td>
            <td>-</td>
            <td>
                ${job.source === 'Supabase' ? `
                    <button class="action-btn btn-danger" onclick="deleteJob('${job.id}')"><i class="fas fa-trash"></i></button>
                    <button class="action-btn" onclick="closeJob('${job.id}')"><i class="fas fa-times-circle"></i></button>
                ` : `
                    <a href="https://docs.google.com/spreadsheets/d/1IxlX3171KL3O0rgTh6ZyXSbU4PCAfDVfBYNB3ALmALY/edit" target="_blank" class="action-btn"><i class="fas fa-external-link-alt"></i> Edit Sheet</a>
                `}
            </td>
        </tr>
    `).join('');
        } catch (e) {
            console.error('UI ERROR (jobs):', e);
            dom.jobsTable.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red;">System Error: ${e.message}</td></tr>`;
        }
    }

    // POST JOB
    dom.postJobForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.textContent = 'Publishing...';
        btn.disabled = true;

        const newJob = {
            job_title: document.getElementById('job-title').value,
            company: document.getElementById('job-company').value,
            location: document.getElementById('job-location').value,
            type: document.getElementById('job-type').value,
            deadline: document.getElementById('job-deadline').value,
            salary: document.getElementById('job-salary').value,
            description: document.getElementById('job-desc').value,
            responsibilities: document.getElementById('job-resp').value.split('\n').filter(r => r.trim()),
            requirements: document.getElementById('job-req').value.split('\n').filter(r => r.trim()),
            email: document.getElementById('job-email').value,
            created_at: new Date().toISOString()
        };

        const { error } = await sbAdmin.from('jobs').insert([newJob]);

        if (error) {
            alert("Error publishing job: " + error.message);
        } else {
            console.log("Job saved to Supabase successfully.");

            // --- WEBHOOK INTEGRATION (LinkedIn / Google Sheets) ---
            if (WEBHOOK_URL) {
                console.log("Triggering automation webhook...");
                try {
                    const webhookResponse = await fetch(WEBHOOK_URL, {
                        method: 'POST',
                        mode: 'no-cors', // Common for cross-origin webhooks
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'job_published',
                            data: newJob
                        })
                    });
                    console.log("Webhook triggered.");
                } catch (webhookErr) {
                    console.error("Webhook failed:", webhookErr);
                    // We don't alert the user here as the job IS published in Supabase
                }
            } else {
                console.warn("No WEBHOOK_URL configured. LinkedIn/Sheets update skipped.");
            }

            alert("Job published successfully!");
            dom.postJobForm.reset();
            switchSection('jobs');
        }
        btn.textContent = 'Publish Job';
        btn.disabled = false;
    });

    // ACTIONS
    window.deleteJob = async (id) => {
        if (!confirm("Are you sure you want to delete this job permanently?")) return;
        const { error } = await sbAdmin.from('jobs').delete().eq('id', id);
        if (error) alert(error.message);
        else loadJobs();
    };

    window.closeJob = async (id) => {
        const { error } = await sbAdmin.from('jobs').update({ status: 'closed' }).eq('id', id);
        if (error) alert(error.message);
        else loadJobs();
    };

    // TSV Parser helper
    function parseTSV(tsvText) {
        if (!tsvText) return [];
        if (tsvText.charCodeAt(0) === 0xFEFF) tsvText = tsvText.substring(1);
        const rows = tsvText.split(/\r?\n/);
        if (rows.length < 1) return [];
        const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
        const result = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i].split('\t');
            if (!rows[i].trim()) continue;
            const obj = {};
            headers.forEach((h, idx) => {
                let val = (values[idx] || '').trim();
                let key = h === 'salary range' ? 'salary' : h;

                // Better mapping for specific headers
                if (h.includes('responsibility') || h.includes('responsibilities')) key = 'responsibilities';
                if (h.includes('requirement')) key = 'requirements';
                if (h === 'job title' || h === 'title') key = 'job_title';
                if (h === 'job description' || h === 'description') key = 'description';
                if (key === 'responsibilities' || key === 'requirements') {
                    obj[key] = val.split(/\n/).map(item => item.trim()).filter(item => item.length > 0);
                } else {
                    obj[key] = val;
                }
            });
            if (!obj.id) obj.id = 'sheet_' + i;
            result.push(obj);
        }
        return result;
    }

    // Start
    checkAuth();
})();
