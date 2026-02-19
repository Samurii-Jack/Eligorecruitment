/**
 * Eligo Recruitment Platform Logic
 * Handles Modals, Job Rendering, Form Submissions, and API Integration.
 * Synchronized with index.html inline script for robustness.
 */

// -------------------------------------------------------------------------
// CONFIGURATION
// -------------------------------------------------------------------------
const SUPABASE_URL = "https://fjvtpaqopqrntbrxbqxg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZqdnRwYXFvcHFybnRicnhicXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzU0ODIsImV4cCI6MjA4NjkxMTQ4Mn0.R5ghQQfwla8-UgBNDBeTMEuRXEmPwO4wdkMt6iT-6gI";
const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRl9nXfkHXdHiZ5OV-Kp8IMMNSp8-nYRUVkFf2Vu80FKaJzm97L7B-wD1USXaNvQnZHWKETjfLr7WeN/pub?gid=0&single=true&output=tsv";

let supabaseClient: any = null;
try {
    if ((window as any).supabase) {
        supabaseClient = (window as any).supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
} catch (e) {
    console.warn("Supabase init skipped in TSX:", e);
}
const WEB3FORMS_ACCESS_KEY = "a5314a4a-a01b-4127-98eb-883ea3cdf096";

// -------------------------------------------------------------------------
// TESTIMONIALS CONFIGURATION (ADD/EDIT NEW TESTIMONIALS HERE)
// -------------------------------------------------------------------------
const TESTIMONIALS = [
    {
        text: "Eligo transformed our hiring. We found our CEO in record time.",
        author: "Sarah J.",
        role: "HR Director",
        initials: "SJ"
    },
    {
        text: "Professional, dedicated, and incredibly efficient team.",
        author: "Mark D.",
        role: "Tech Lead",
        initials: "MD"
    },
    {
        text: "Best recruitment experience I've had in 10 years.",
        author: "Global Logistics",
        role: "Partner",
        initials: "GL"
    }
];

// --- Mock Data (Fallback) ---
const DEFAULT_JOBS = [
    {
        id: 1,
        title: "Senior Product Manager",
        company: "TechFin Solutions",
        location: "London (Hybrid)",
        type: "Full-time",
        deadline: "2023-12-15",
        description: "Leading our core banking product transformation.",
        responsibilities: ["Define product vision", "Manage stakeholder expectations", "Lead sprint planning"],
        salary: "£80,000 - £110,000"
    },
    {
        id: 2,
        title: "Frontend Developer",
        company: "Creative Studio",
        location: "Remote",
        type: "Contract",
        deadline: "2023-11-30",
        description: "Building immersive web experiences for luxury brands.",
        responsibilities: ["Develop responsive UIs", "Optimize for performance", "Collaborate with designers"],
        salary: "$60 - $80 / hr"
    },
    {
        id: 3,
        title: "HR Director",
        company: "Global Logistics",
        location: "New York (On-site)",
        type: "Full-time",
        deadline: "2024-01-10",
        description: "Overseeing talent acquisition and employee relations for 500+ staff.",
        responsibilities: ["Strategy development", "Compliance management", "Executive reporting"],
        salary: "Competitive"
    }
];

let jobs = []; // Will hold combined jobs (Mock + Sheet + Local)
let currentJob = null;

// --- State & Selectors ---
const dom = {
    modals: {
        list: document.getElementById('modal-list-job'),
        apply: document.getElementById('modal-apply-job'),
        success: document.getElementById('modal-success')
    },
    triggers: {
        list: document.getElementById('nav-list-job'),
        apply: document.getElementById('nav-apply-job'),
        heroApply: document.getElementById('hero-cta-apply'),
        heroList: document.getElementById('hero-cta-list')
    },
    views: {
        listings: document.getElementById('view-listings'),
        details: document.getElementById('view-details'),
        application: document.getElementById('view-application')
    },
    containers: {
        listings: document.getElementById('listings-container'),
        details: document.getElementById('job-detail-content'),
        testimonials: document.getElementById('testimonials-container')
    },
    forms: {
        list: document.getElementById('form-list-job') as HTMLFormElement,
        apply: document.getElementById('form-application') as HTMLFormElement,
        contact: document.getElementById('contactForm') as HTMLFormElement
    },
    filters: {
        search: document.getElementById('job-search') as HTMLInputElement,
        type: document.getElementById('job-filter-type') as HTMLSelectElement
    }
};

// --- Modal System ---
const app = {
    openModal: (modalId) => {
        const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
        if (modal) {
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; // Lock scroll
        }
    },

    closeModal: (modal) => {
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
    },

    closeAll: () => {
        document.querySelectorAll('.modal-overlay').forEach(m => app.closeModal(m));
    },

    switchView: (viewId) => {
        Object.values(dom.views).forEach(el => el && el.classList.remove('active'));
        dom.views[viewId]?.classList.add('active');
        // Reset scroll position of container
        if (dom.modals.apply) {
            const container = dom.modals.apply.querySelector('.modal-container');
            if (container) container.scrollTop = 0;
        }
    },

    showSuccess: (title, msg) => {
        app.closeAll();
        const titleEl = document.getElementById('success-title');
        const msgEl = document.getElementById('success-msg');
        if (titleEl) titleEl.textContent = title;
        if (msgEl) msgEl.textContent = msg;
        app.openModal('modal-success');
    }
};

// Expose to window for inline onclick handlers
(window as any).app = app;

// --- RENDER TESTIMONIALS ---
function renderTestimonials() {
    if (!dom.containers.testimonials) return;

    dom.containers.testimonials.innerHTML = '';

    // Create track for infinite scroll
    const track = document.createElement('div');
    track.className = 'testimonial-track';

    // Duplicate content for seamless loop (mock infinite)
    // We duplicate 4 times to ensure it covers screens comfortably
    const loopCount = 4;

    for (let i = 0; i < loopCount; i++) {
        TESTIMONIALS.forEach((t, index) => {
            const card = document.createElement('div');
            card.className = 'testimonial-card';

            card.innerHTML = `
                <div class="testimonial-text">"${t.text}"</div>
                <div class="testimonial-author">
                    <div class="testimonial-avatar">${t.initials}</div>
                    <div class="testimonial-info">
                        <h5>${t.author}</h5>
                        <span>${t.role}</span>
                    </div>
                </div>
            `;
            track.appendChild(card);
        });
    }

    dom.containers.testimonials.appendChild(track);
}

// --- DATA FETCHING & MANAGEMENT ---

async function fetchJobs() {
    let allJobs: any[] = [];
    console.log('%c--- fetchJobs started ---', 'color: #c9a860; font-weight: bold;');

    // Protocol check for local file security
    const isLocalFile = window.location.protocol === 'file:';

    // 1. Fetch from Google Sheet (Prioritize these)
    if (GOOGLE_SHEET_URL && !isLocalFile) {
        try {
            // Add cache buster
            const sheetUrl = GOOGLE_SHEET_URL + (GOOGLE_SHEET_URL.includes('?') ? '&' : '?') + 'cb=' + Date.now();
            console.log('Fetching Google Sheet:', sheetUrl);

            const response = await fetch(sheetUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const data = await response.text();
            console.log('Raw Sheet data received. Bytes:', data.length);

            const sheetJobs = parseTSV(data);
            console.log(`%cSuccessfully loaded ${sheetJobs.length} jobs from Google Sheet`, 'color: #10b981; font-weight: bold;');

            if (sheetJobs.length > 0) {
                allJobs = [...allJobs, ...sheetJobs];
            }
        } catch (error) {
            console.error("Critical error fetching Google Sheet:", error);
        }
    }

    // 2. Fetch from Supabase
    if (supabaseClient) {
        try {
            const { data, error } = await (supabaseClient as any).from('jobs').select('*').order('created_at', { ascending: false });
            if (error) throw error;

            if (data) {
                console.log('Supabase raw data count:', data.length);
                const normalizedData = data.map((job: any) => {
                    const normalized: any = {};
                    Object.keys(job).forEach(k => {
                        normalized[k.toLowerCase()] = job[k];
                    });
                    return normalized;
                });
                allJobs = [...allJobs, ...normalizedData];
                console.log('Jobs added from Supabase:', normalizedData.length);
            }
        } catch (e) {
            console.warn('Supabase jobs fetch failed:', e);
        }
    }

    // Fallback to defaults
    if (allJobs.length === 0) {
        console.log('No jobs found in Sheet or Supabase, using defaults.');
        allJobs = [...DEFAULT_JOBS];
    }

    // 3. Fetch Locally Submitted Jobs
    const localJobs = JSON.parse(localStorage.getItem('eligo_custom_jobs') || '[]');
    console.log('Local storage jobs found:', localJobs.length);

    jobs = [...localJobs, ...allJobs];
    console.log('Total combined jobs:', jobs.length);
    renderJobs(jobs);
}

// Simple TSV Parser for Google Sheets
function parseTSV(tsvText: string) {
    if (!tsvText) return [];

    // Handle UTF-8 BOM if present
    if (tsvText.charCodeAt(0) === 0xFEFF) {
        tsvText = tsvText.substring(1);
    }

    const rows = tsvText.split(/\r?\n/);
    if (rows.length < 1) return [];

    // Robust header extraction
    const headers = rows[0].split('\t').map(h => h.trim().toLowerCase());
    console.log('Detected Sheet Headers:', headers);

    const result: any[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;

        const values = rows[i].split('\t');
        const obj: any = {};
        let hasContent = false;

        headers.forEach((header, index) => {
            let val = (values[index] || '').trim();
            if (val) hasContent = true;

            // Map Sheet Headers to App Keys
            let key = header;
            if (header === 'requirements' || header === 'responsibilities') key = 'responsibilities';
            if (header === 'salary range' || header === 'salary') key = 'salary';

            // Standardize keys
            if (header === 'job title' || header === 'title') key = 'title';
            if (header === 'job description' || header === 'description') key = 'description';

            // Handle list conversion for responsibilities
            if (key === 'responsibilities' || key === 'qualifications') {
                obj[key] = val.split(/[,\n|•]/).map(item => item.trim()).filter(item => item.length > 0);
            } else {
                obj[key] = val;
            }
        });

        // Standardize ID
        if (!obj.id) obj.id = 'sheet_' + i;
        if (!obj.title && obj.job_title) obj.title = obj.job_title;

        if (hasContent && (obj.title || obj.id)) {
            result.push(obj);
        }
    }
    return result;
}

// --- Render Logic ---

function renderJobs(data) {
    if (!dom.containers.listings) return;
    dom.containers.listings.innerHTML = '';

    if (data.length === 0) {
        dom.containers.listings.innerHTML = '<p class="text-center" style="color: var(--text-light); padding: 2rem;">No jobs found matching criteria.</p>';
        return;
    }

    data.forEach(job => {
        const div = document.createElement('div');
        div.className = 'job-card';

        // Defensive access for title (handle Title, title, job_title etc)
        const displayTitle = job.title || job.Title || job.job_title || job.JobTitle || 'Untitled Role';
        const displayType = job.type || job.Type || 'Full-time';
        const displayCompany = job.company || job.Company || 'Confidential';
        const displayLocation = job.location || job.Location || 'Remote';
        const displayDeadline = job.deadline || job.Deadline || 'Open';

        // Defensive access for salary
        const displaySalary = job.salary || job.Salary || job.salary_range || job['salary range'] || 'Competitive';

        div.innerHTML = `
            <div class="job-card-header">
                <h3 style="font-size: 1.1rem; color: var(--primary-navy);">${displayTitle}</h3>
                <span class="job-tag">${displayType}</span>
            </div>
            <div style="font-weight: 500; color: var(--text-gray); font-size: 0.95rem;">${displayCompany}</div>
            <div class="job-meta">
                <span><i class="fas fa-map-marker-alt"></i> ${displayLocation}</span>
                <span><i class="far fa-clock"></i> ${displayDeadline}</span>
                <span style="color: var(--accent-gold); font-weight: 600;"><i class="fas fa-money-bill-wave"></i> ${displaySalary}</span>
            </div>
        `;
        div.addEventListener('click', () => loadJobDetails(job));
        dom.containers.listings!.appendChild(div);
    });
}

function loadJobDetails(job) {
    currentJob = job;

    // Defensive access for details
    const displayTitle = job.title || job.Title || job.job_title || job.JobTitle || 'Untitled Role';
    const displayCompany = job.company || job.Company || 'Confidential';
    const displayLocation = job.location || job.Location || 'Remote';
    const displayDescription = job.description || job.Overview || job.Overview || job.Description || 'No description provided.';
    const responsibilities = job.responsibilities || job.Responsibilities || job.requirements || job.Requirements || [];

    // Handle responsibilities being a string or array
    let responsibilitiesList = '';
    if (Array.isArray(responsibilities)) {
        responsibilitiesList = responsibilities.map(i => `<li>${i}</li>`).join('');
    } else if (typeof responsibilities === 'string') {
        responsibilitiesList = responsibilities.split(/\n|•/).filter(i => i.trim().length > 0).map(i => `<li>${i}</li>`).join('');
    }

    if (!dom.containers.details) return;

    dom.containers.details.innerHTML = `
        <div style="border-bottom: 1px solid var(--border-gray); padding-bottom: 1rem; margin-bottom: 1.5rem;">
            <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem;">${displayTitle}</h2>
            <div style="display:flex; gap: 1rem; color: var(--text-gray); font-size: 0.9rem;">
                <span>${displayCompany}</span>
                <span>&bull;</span>
                <span>${displayLocation}</span>
            </div>
        </div>
        
        <h4 style="margin: 1rem 0 0.5rem;">Overview</h4>
        <p style="color: var(--text-gray); font-size: 0.95rem;">${displayDescription}</p>
        
        ${responsibilitiesList ? `<h4 style="margin: 1.5rem 0 0.5rem;">Key Responsibilities</h4>
        <ul style="padding-left: 1.2rem; color: var(--text-gray); font-size: 0.95rem;">${responsibilitiesList}</ul>` : ''}
        
        <div class="job-actions">
            <button class="btn btn-primary" id="btn-apply-now">Apply for this Job</button>
        </div>
    `;

    document.getElementById('btn-apply-now')?.addEventListener('click', () => {
        const titleEl = document.getElementById('apply-role-title');
        if (titleEl) titleEl.textContent = displayTitle;
        const idInput = document.getElementById('app-job-id') as HTMLInputElement;
        if (idInput) idInput.value = displayTitle; // Ensure normalized title is used
        app.switchView('application');
    });

    app.switchView('details');
}

// --- Event Listeners ---

// 1. Navigation Triggers
if (dom.triggers.list) {
    dom.triggers.list.addEventListener('click', (e) => {
        e.preventDefault();
        app.openModal(dom.modals.list);
    });
}

const openApplyModal = (e) => {
    e.preventDefault();
    app.switchView('listings'); // Reset to listings
    renderJobs(jobs);
    app.openModal(dom.modals.apply);
};

if (dom.triggers.apply) dom.triggers.apply.addEventListener('click', openApplyModal);
if (dom.triggers.heroApply) dom.triggers.heroApply.addEventListener('click', openApplyModal);

// Listener for the new Hero Button (List A Job)
if (dom.triggers.heroList) {
    dom.triggers.heroList.addEventListener('click', (e) => {
        e.preventDefault();
        app.openModal(dom.modals.list);
    });
}

// 2. Close Actions
document.querySelectorAll('.modal-close, .modal-close-btn, .modal-close-all').forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('modal-close-all')) app.closeAll();
        else app.closeModal(btn.closest('.modal-overlay'));
    });
});

// Close on outside click
document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) app.closeModal(modal);
    });
});

// 3. Job Filtering
const filterJobs = () => {
    const term = dom.filters.search.value.toLowerCase();
    const type = dom.filters.type.value;

    const filtered = jobs.filter(job => {
        const title = job.title ? job.title.toLowerCase() : '';
        const company = job.company ? job.company.toLowerCase() : '';

        const matchText = title.includes(term) || company.includes(term);
        const matchType = type === 'all' || job.type === type;
        return matchText && matchType;
    });
    renderJobs(filtered);
};

if (dom.filters.search) dom.filters.search.addEventListener('input', filterJobs);
if (dom.filters.type) dom.filters.type.addEventListener('change', filterJobs);

// --- Drag & Drop File Upload ---

function setupFileDrop(areaId: string) {
    const area = document.getElementById(areaId);
    if (!area) return;

    const input = area.querySelector('input[type="file"]') as HTMLInputElement;
    const nameDisplay = area.querySelector('.file-name');

    area.addEventListener('click', () => input && input.click());

    if (input) {
        input.addEventListener('change', () => {
            if (input.files && input.files.length && nameDisplay) nameDisplay.textContent = input.files[0].name;
        });
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        area.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    ['dragenter', 'dragover'].forEach(evt => {
        area.addEventListener(evt, () => area.classList.add('drag-active'));
    });

    ['dragleave', 'drop'].forEach(evt => {
        area.addEventListener(evt, () => area.classList.remove('drag-active'));
    });

    area.addEventListener('drop', (e) => {
        const files = (e as DragEvent).dataTransfer?.files;
        if (files && files.length) {
            if (input) input.files = files; // Note: works in modern browsers
            if (nameDisplay) nameDisplay.textContent = files[0].name;
        }
    });
}

setupFileDrop('drop-cv');
setupFileDrop('drop-cl');

// --- FORM HANDLING (Web3Forms + Local Updates) ---

const prepareFormData = (form: HTMLFormElement) => {
    const fd = new FormData(form);
    fd.append('access_key', WEB3FORMS_ACCESS_KEY);
    return fd;
};

// Handle Job Listing Submission
if (dom.forms.list) {
    dom.forms.list.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = dom.forms.list.querySelector('button[type="submit"]') as HTMLButtonElement;
        const status = dom.forms.list.querySelector('.status-msg') as HTMLElement;
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
        if (status) status.style.display = 'none';

        const formData = prepareFormData(dom.forms.list);

        // Create Local Object
        const newJob = {
            id: 'local_' + Date.now(),
            title: formData.get('title'),
            company: formData.get('company'),
            location: formData.get('location'),
            type: formData.get('type'),
            deadline: formData.get('deadline'),
            description: formData.get('overview'),
            responsibilities: formData.get('responsibilities') ? (formData.get('responsibilities') as string).split('\n') : [],
            salary: "Competitive"
        };

        try {
            await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });

            // Save Locally
            const existingLocal = JSON.parse(localStorage.getItem('eligo_custom_jobs') || '[]');
            existingLocal.push(newJob);
            localStorage.setItem('eligo_custom_jobs', JSON.stringify(existingLocal));

            // Update UI
            jobs.unshift(newJob);
            renderJobs(jobs);

            btn.innerHTML = originalText;
            btn.disabled = false;
            dom.forms.list.reset();
            app.showSuccess('Job Posted', 'Your listing has been submitted! Our team will review and invoice the $150 listing fee.');

        } catch (error) {
            console.error(error);
            btn.innerHTML = originalText;
            btn.disabled = false;
            app.showSuccess('Job Posted', 'Your listing has been submitted! (Email service unavailable, simulated success).');
        }
    });
}

// Handle Job Application Submission
if (dom.forms.apply) {
    dom.forms.apply.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = dom.forms.apply.querySelector('button[type="submit"]') as HTMLButtonElement;
        const status = dom.forms.apply.querySelector('.status-msg') as HTMLElement;
        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
        btn.disabled = true;
        if (status) status.style.display = 'none';

        const formData = prepareFormData(dom.forms.apply);

        try {
            // 1. Send via Web3Forms
            await fetch('https://api.web3forms.com/submit', {
                method: 'POST',
                body: formData
            });

            // 2. Also save to Supabase (non-blocking)
            if (supabaseClient) {
                try {
                    console.log('Attempting to save application to Supabase...');
                    const jobTitle = formData.get('job_id') || formData.get('position') || 'General';

                    const { error } = await supabaseClient.from('applications').insert([{
                        full_name: formData.get('name'),
                        email: formData.get('email'),
                        job_id: jobTitle,
                        position: jobTitle,
                        message: formData.get('message'),
                        resume_url: null, // Basic version for now
                        created_at: new Date().toISOString()
                    }]);

                    if (error) throw error;
                    console.log('Application also saved to Supabase successfully.');
                } catch (sbError) {
                    console.warn('Supabase application save failed:', sbError);
                }
            }

            btn.innerHTML = originalText;
            btn.disabled = false;
            dom.forms.apply.reset();
            document.querySelectorAll('.file-name').forEach(el => el.textContent = '');
            app.showSuccess('Application Sent', 'Good luck! The employer has received your application.');

        } catch (error) {
            console.error('Submission error:', error);
            btn.innerHTML = originalText;
            btn.disabled = false;
            app.showSuccess('Application Sent', 'Application simulated (Email service unavailable).');
        }
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchJobs();
    renderTestimonials();
});
