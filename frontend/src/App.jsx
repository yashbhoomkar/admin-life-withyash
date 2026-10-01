import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiUrl } from './api.js';

const navItems = [
  ['overview', 'Overview'],
  ['content', 'Content'],
  ['messages', 'Messages'],
];

const emptyData = {
  stats: { visits: 0, messages: 0, playlists: 0, dialogues: 0, photos: 0, sections: 0 },
  content: { sections: [], playlists: [], dialogues: [], photos: [] },
  messages: [],
};

function AuthScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setStatus('');
    setBusy(true);

    try {
      const response = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Login failed.');
      onLogin(result.token);
    } catch (error) {
      setStatus(error.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <div className="eyebrow">YAXH / PRIVATE</div>
        <h1>Admin dashboard</h1>
        <p className="muted">Manage Life With Yash content directly in MongoDB.</p>
        <form className="card auth-card" onSubmit={submit}>
          <label className="field">
            <span>Username</span>
            <input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="primary-button" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
          {status && <p className="status error">{status}</p>}
        </form>
      </div>
    </main>
  );
}

function Layout({ page, setPage, stats, onSignOut, children }) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="eyebrow">YAXH</div>
          <strong>Life With Yash</strong>
          <span>Admin</span>
        </div>
        <nav className="nav" aria-label="Admin navigation">
          {navItems.map(([key, label]) => (
            <button
              key={key}
              className={`nav-item ${page === key ? 'active' : ''}`}
              onClick={() => setPage(key)}
              type="button"
            >
              <span>{label}</span>
              {key === 'messages' && stats.messages > 0 && <b>{stats.messages}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="live-dot" /> MongoDB connected
          <button className="ghost-button" onClick={onSignOut} type="button">Sign out</button>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">PRIVATE CONTROL PANEL</div>
            <h1>{navItems.find(([key]) => key === page)?.[1] || 'Dashboard'}</h1>
          </div>
          <div className="top-stats">
            <span>Visits</span>
            <strong>{stats.visits.toLocaleString()}</strong>
          </div>
        </header>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function OverviewPage({ data, reload, setPage }) {
  return (
    <div className="stack">
      <section className="stats-grid">
        <StatCard label="Website visits" value={data.stats.visits} />
        <StatCard label="Visitor messages" value={data.stats.messages} />
        <StatCard label="Playlists" value={data.stats.playlists} />
        <StatCard label="Dialogues" value={data.stats.dialogues} />
        <StatCard label="Photos" value={data.stats.photos} />
        <StatCard label="Sections" value={data.stats.sections} />
      </section>

      <section className="two-column">
        <div className="card">
          <div className="card-heading">
            <div>
              <div className="eyebrow">CONTENT</div>
              <h2>What the public site reads</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => setPage('content')}>Manage</button>
          </div>
          <div className="overview-list">
            {[
              ['Sections', data.content.sections.length],
              ['Spotify playlists', data.content.playlists.length],
              ['Movie dialogues', data.content.dialogues.length],
              ['Car photos', data.content.photos.length],
            ].map(([label, value]) => (
              <div key={label}><span>{label}</span><strong>{value}</strong></div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-heading">
            <div>
              <div className="eyebrow">RECENT</div>
              <h2>Latest messages</h2>
            </div>
            <button className="ghost-button" type="button" onClick={() => setPage('messages')}>View all</button>
          </div>
          {data.messages.length ? data.messages.slice(0, 5).map((message) => (
            <article className="message-preview" key={message.id}>
              <div className="message-meta">
                <strong>{message.name || 'Anonymous'}</strong>
                <time>{new Date(message.createdAt).toLocaleString()}</time>
              </div>
              <p>{message.message}</p>
            </article>
          )) : <p className="muted">No visitor messages yet.</p>}
        </div>
      </section>

      <button className="ghost-button refresh" type="button" onClick={reload}>Refresh dashboard</button>
    </div>
  );
}

function Status({ value }) {
  return value ? <p className={`status ${value.toLowerCase().includes('error') || value.toLowerCase().includes('failed') ? 'error' : ''}`}>{value}</p> : null;
}

function SectionManager({ sections, onChange, callApi }) {
  const [newTitle, setNewTitle] = useState('');
  const [status, setStatus] = useState('');

  async function addSection(event) {
    event.preventDefault();
    setStatus('Saving…');
    try {
      const created = await callApi('/api/admin/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      });
      onChange([...sections, created].sort((a, b) => a.order - b.order));
      setNewTitle('');
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card">
      <div className="card-heading">
        <div>
          <div className="eyebrow">STRUCTURE</div>
          <h2>Section names</h2>
        </div>
      </div>
      <div className="record-stack">
        {sections.map((section) => (
          <SectionRow key={section.key} section={section} onChange={onChange} callApi={callApi} />
        ))}
      </div>
      <form className="inline-form" onSubmit={addSection}>
        <input placeholder="New section name" maxLength={60} required value={newTitle} onChange={(event) => setNewTitle(event.target.value)} />
        <button className="primary-button" type="submit">Add section</button>
      </form>
      <Status value={status} />
    </section>
  );
}

function SectionRow({ section, onChange, callApi }) {
  const [title, setTitle] = useState(section.title);
  const [status, setStatus] = useState('');

  useEffect(() => setTitle(section.title), [section.title]);

  async function save() {
    setStatus('Saving…');
    try {
      const updated = await callApi(`/api/admin/sections/${encodeURIComponent(section.key)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      onChange((current) => current.map((item) => item.key === updated.key ? updated : item));
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="record-row">
      <div className="record-main">
        <span className="record-kicker">{section.key}</span>
        <input value={title} maxLength={60} onChange={(event) => setTitle(event.target.value)} />
      </div>
      <div className="record-actions">
        <button className="ghost-button" type="button" onClick={save}>Update</button>
        <small>{status}</small>
      </div>
    </div>
  );
}

function PlaylistManager({ playlists, onChange, callApi }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState('');

  async function add(event) {
    event.preventDefault();
    setStatus('Saving…');
    try {
      const created = await callApi('/api/admin/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, url }),
      });
      onChange((current) => [...current, created].sort((a, b) => a.order - b.order));
      setTitle('');
      setUrl('');
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card">
      <div className="card-heading"><div><div className="eyebrow">SPOTIFY</div><h2>Playlists</h2></div></div>
      <form className="form-grid" onSubmit={add}>
        <label className="field"><span>Playlist name</span><input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label className="field"><span>Playlist URL</span><input required type="url" placeholder="https://open.spotify.com/playlist/…" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <button className="primary-button" type="submit">Add playlist</button>
      </form>
      <Status value={status} />
      <div className="record-stack">
        {playlists.map((playlist) => <EditablePlaylist key={playlist.slug} playlist={playlist} onChange={onChange} callApi={callApi} />)}
        {!playlists.length && <p className="muted">No playlists saved.</p>}
      </div>
    </section>
  );
}

function EditablePlaylist({ playlist, onChange, callApi }) {
  const [title, setTitle] = useState(playlist.title);
  const [status, setStatus] = useState('');

  useEffect(() => setTitle(playlist.title), [playlist.title]);

  async function save() {
    setStatus('Saving…');
    try {
      const updated = await callApi(`/api/admin/playlists/${encodeURIComponent(playlist.slug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      onChange((current) => current.map((item) => item.slug === updated.slug ? updated : item));
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete playlist "${playlist.title}"?`)) return;
    try {
      await callApi(`/api/admin/playlists/${encodeURIComponent(playlist.slug)}`, { method: 'DELETE' });
      onChange((current) => current.filter((item) => item.slug !== playlist.slug));
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="record-row">
      <div className="record-main">
        <span className="record-kicker">{playlist.slug}</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={100} />
        <a className="record-link" href={playlist.embedUrl} target="_blank" rel="noreferrer">Open Spotify embed ↗</a>
      </div>
      <div className="record-actions">
        <button className="ghost-button" type="button" onClick={save}>Update</button>
        <button className="danger-button" type="button" onClick={remove}>Delete</button>
        <small>{status}</small>
      </div>
    </div>
  );
}

function DialogueManager({ dialogues, onChange, callApi }) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState('');

  async function add(event) {
    event.preventDefault();
    setStatus('Saving…');
    try {
      const created = await callApi('/api/admin/dialogues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      onChange((current) => [...current, created]);
      setText('');
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card">
      <div className="card-heading"><div><div className="eyebrow">MOVIE DIALOGUES</div><h2>Dialogues</h2></div></div>
      <form className="form-grid" onSubmit={add}>
        <label className="field"><span>Dialogue</span><textarea required maxLength={1000} rows={4} value={text} onChange={(event) => setText(event.target.value)} /></label>
        <button className="primary-button" type="submit">Add dialogue</button>
      </form>
      <Status value={status} />
      <div className="record-stack">
        {dialogues.map((dialogue, index) => <EditableDialogue key={dialogue.id} dialogue={dialogue} number={index + 1} onChange={onChange} callApi={callApi} />)}
        {!dialogues.length && <p className="muted">No dialogues saved.</p>}
      </div>
    </section>
  );
}

function EditableDialogue({ dialogue, number, onChange, callApi }) {
  const [text, setText] = useState(dialogue.text);
  const [status, setStatus] = useState('');

  useEffect(() => setText(dialogue.text), [dialogue.text]);

  async function save() {
    setStatus('Saving…');
    try {
      const updated = await callApi(`/api/admin/dialogues/${encodeURIComponent(dialogue.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      onChange((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function remove() {
    if (!window.confirm('Delete this dialogue?')) return;
    try {
      await callApi(`/api/admin/dialogues/${encodeURIComponent(dialogue.id)}`, { method: 'DELETE' });
      onChange((current) => current.filter((item) => item.id !== dialogue.id));
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <div className="record-row">
      <div className="dialogue-number">{String(number).padStart(2, '0')}</div>
      <div className="record-main wide">
        <textarea value={text} maxLength={1000} rows={3} onChange={(event) => setText(event.target.value)} />
      </div>
      <div className="record-actions">
        <button className="ghost-button" type="button" onClick={save}>Update</button>
        <button className="danger-button" type="button" onClick={remove}>Delete</button>
        <small>{status}</small>
      </div>
    </div>
  );
}

function PhotoManager({ photos, onChange, callApi }) {
  const [name, setName] = useState('');
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('');

  async function add(event) {
    event.preventDefault();
    if (!file) {
      setStatus('Choose a photo first.');
      return;
    }

    setStatus('Preparing image…');

    try {
      const [full, thumbnail] = await Promise.all([
        makeJpeg(file, 2400, 0.9),
        makeJpeg(file, 640, 0.82),
      ]);

      const form = new FormData();
      form.append('name', name);
      form.append('image', full.blob, 'photo.jpg');
      form.append('thumbnail', thumbnail.blob, 'thumbnail.jpg');
      form.append('imageWidth', full.width);
      form.append('imageHeight', full.height);
      form.append('thumbnailWidth', thumbnail.width);
      form.append('thumbnailHeight', thumbnail.height);

      const created = await callApi('/api/admin/photos', { method: 'POST', body: form });
      onChange((current) => [...current, created].sort((a, b) => a.order - b.order));
      setName('');
      setFile(null);
      event.currentTarget.reset();
      setStatus('Saved.');
    } catch (error) {
      setStatus(error.message);
    }
  }

  async function remove(photo) {
    if (!window.confirm(`Delete photo "${photo.name}"?`)) return;
    try {
      await callApi(`/api/admin/photos/${encodeURIComponent(photo.slug)}`, { method: 'DELETE' });
      onChange((current) => current.filter((item) => item.slug !== photo.slug));
    } catch (error) {
      setStatus(error.message);
    }
  }

  return (
    <section className="card">
      <div className="card-heading"><div><div className="eyebrow">GALLERY</div><h2>Photos</h2></div></div>
      <form className="form-grid" onSubmit={add}>
        <label className="field"><span>Photo name</span><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="field"><span>Photo</span><input required type="file" accept="image/*" onChange={(event) => setFile(event.target.files?.[0] || null)} /><small>Converted in-browser to optimized JPEG + thumbnail before upload.</small></label>
        <button className="primary-button" type="submit">Upload photo</button>
      </form>
      <Status value={status} />
      <div className="photo-grid">
        {photos.map((photo) => (
          <article className="photo-card" key={photo.slug}>
            <img src={apiUrl(photo.thumbnailUrl)} alt={photo.name} />
            <div className="photo-card-body">
              <strong>{photo.name}</strong>
              <span>{photo.fullWidth} × {photo.fullHeight}</span>
              <div className="photo-card-actions">
                <a className="ghost-button" href={apiUrl(photo.fullUrl)} target="_blank" rel="noreferrer">Open</a>
                <button className="danger-button" type="button" onClick={() => remove(photo)}>Delete</button>
              </div>
            </div>
          </article>
        ))}
        {!photos.length && <p className="muted">No photos saved.</p>}
      </div>
    </section>
  );
}

function ContentPage({ data, setData, callApi }) {
  return (
    <div className="stack">
      <SectionManager sections={data.content.sections} onChange={(next) => setData((current) => ({ ...current, content: { ...current.content, sections: typeof next === 'function' ? next(current.content.sections) : next } }))} callApi={callApi} />
      <PlaylistManager playlists={data.content.playlists} onChange={(next) => setData((current) => ({ ...current, content: { ...current.content, playlists: typeof next === 'function' ? next(current.content.playlists) : next } }))} callApi={callApi} />
      <DialogueManager dialogues={data.content.dialogues} onChange={(next) => setData((current) => ({ ...current, content: { ...current.content, dialogues: typeof next === 'function' ? next(current.content.dialogues) : next } }))} callApi={callApi} />
      <PhotoManager photos={data.content.photos} onChange={(next) => setData((current) => ({ ...current, content: { ...current.content, photos: typeof next === 'function' ? next(current.content.photos) : next } }))} callApi={callApi} />
    </div>
  );
}

function MessagesPage({ messages }) {
  return (
    <div className="stack">
      <section className="card">
        <div className="card-heading">
          <div><div className="eyebrow">INBOX</div><h2>Visitor messages</h2></div>
          <span className="count-pill">{messages.length}</span>
        </div>
        {messages.length ? messages.map((message) => (
          <article className="message-item" key={message.id}>
            <header>
              <div>
                <strong>{message.name || 'Anonymous'}</strong>
                <span>{new Date(message.createdAt).toLocaleString()}</span>
              </div>
            </header>
            <p>{message.message}</p>
          </article>
        )) : <p className="muted">No visitor messages yet.</p>}
      </section>
    </div>
  );
}

function fileDimensions(file) {
  return createImageBitmap(file).then((bitmap) => ({ bitmap, width: bitmap.width, height: bitmap.height }));
}

async function makeJpeg(file, maxSide, quality) {
  const { bitmap, width, height } = await fileDimensions(file);
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Could not process image.')), 'image/jpeg', quality);
  });

  return { blob, width: canvas.width, height: canvas.height };
}

export default function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem('adminToken') || '');
  const [data, setData] = useState(emptyData);
  const [page, setPage] = useState('overview');
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');

  const signOut = useCallback(() => {
    sessionStorage.removeItem('adminToken');
    setToken('');
    setData(emptyData);
    setPage('overview');
  }, []);

  const callApi = useCallback(async (path, options = {}) => {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (response.status === 401) {
      signOut();
      throw new Error('Your session expired. Please sign in again.');
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || 'Request failed.');
    return payload;
  }, [signOut, token]);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError('');

    try {
      const result = await callApi('/api/admin/dashboard');
      setData(result);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }, [callApi, token]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    if (!token) return undefined;
    const interval = window.setInterval(() => {
      callApi('/api/admin/dashboard').then(setData).catch(() => {});
    }, 30000);
    return () => window.clearInterval(interval);
  }, [callApi, token]);

  const pageContent = useMemo(() => {
    if (page === 'content') return <ContentPage data={data} setData={setData} callApi={callApi} />;
    if (page === 'messages') return <MessagesPage messages={data.messages} />;
    return <OverviewPage data={data} reload={reload} setPage={setPage} />;
  }, [callApi, data, page, reload]);

  if (!token) return <AuthScreen onLogin={(value) => { sessionStorage.setItem('adminToken', value); setToken(value); }} />;

  return (
    <Layout page={page} setPage={setPage} stats={data.stats} onSignOut={signOut}>
      {loading && !data.content.sections.length ? <div className="card loading-card">Loading dashboard…</div> : null}
      {error ? <div className="card error-card">{error} <button className="ghost-button" type="button" onClick={reload}>Retry</button></div> : null}
      {pageContent}
    </Layout>
  );
}
