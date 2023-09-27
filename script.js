var tabView = document.getElementById("bar-view")
var sidebar = document.getElementById("sidebar")
var folderSelect = document.getElementById("folder-select")
var seeker = document.getElementById("control-seek-input");
var loader = document.getElementById("loader");
var loading = document.getElementById("loading");

var progressbar = document.getElementById("progressbar");
var progressbarInner = document.getElementById("progressbar-inner");

progressbar.style.display = "none";


loading.innerText = "loading..."

document.body.onload = function() {
    loader.style.display = "none";
}

var jsmediatags = window.jsmediatags;
// Create audio context.
const ctx = new window.AudioContext();

// Autoplay policy: start context after user gesture.
window.addEventListener('click', () => {
  ctx.resume().then(() => {
    console.log('AudioContext started');
  });
}, {
  once: true,
  capture: true,
  passive: true,
});

var source = null;

var ctxTimeOffset = 0;

var ignoreEnd = false;

seeker.oninput = function(event) {
    value = seeker.value;
    newSource = ctx.createBufferSource();
    newSource.buffer = source.buffer;
    newSource.connect(ctx.destination);
    ignoreEnd = true;
    source.stop()
    source = newSource
    source.start(0, value / 100); 
    source.onended = function(event) {
      console.log("ended");
      console.log(ignoreEnd)
      if (ignoreEnd) {
        ignoreEnd = false;
        return;
    }
      console.log("Not ignored");

      ctxTimeOffset = false;
    }
    ctxTimeOffset = ctx.currentTime - value/100;
};

// Play local audio file.
async function playAudio (fileHandle, imageURL, tags) {
  if (source) {
      source.stop();
  }
  playButton()
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

  document.getElementById("currently-playing-art").src = imageURL;
  document.getElementById("currently-playing-title").innerText = tags.title;


  // Create source node
  source = ctx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(ctx.destination);
  source.start(0); 
  source.onended = function(event) {
      console.log("end");
      console.log(event)
      if (ignoreEnd) {
        ignoreEnd = false;
        return;
    }
      ctxTimeOffset = false;
  }
  ctxTimeOffset = ctx.currentTime;
}

function playButton() {
    ctx.resume()
    seeker.disabled = false;
}
function pauseButton() {
    ctx.suspend()
    seeker.disabled = true;
}

function getPlayingTime() {
    if (!source) {
        return 0;
    }
    if (!ctxTimeOffset) {
        return getPlayingLength();
    }
    return ctx.currentTime - ctxTimeOffset;
}
function getPlayingLength() {
    if (source) {
        return source.buffer.duration;
    }
    return 0;
}

function updateSeekBar() {
    let playingTime = Math.trunc(getPlayingTime() * 100)
    let playingLength = Math.trunc(getPlayingLength() * 100)
    seeker.max = playingLength;
    seeker.value = playingTime;
}

var directory;
var db = new Dexie("offbeat");
db.version(1).stores({
    directory: `
    name,
    handle`,
});

var handles = [];

var songs = {}

var albumElements = {};
var artistElements = {};


var menu = [
    "songs",
    "albums",
    "artists"
]

var menuItems = {}

menu.forEach((value, index, array) => {
    var tabButton = document.createElement("div");
    tabButton.classList.add("tab-button");
    tabButton.tab = value;
    tabButton.onclick = function(event) {
        let value = event.target.tab;
        document.getElementById(value).scrollIntoView({block: "start", inline: 
    "nearest", behavior: "smooth"})
    }
    tabButton.innerText = value;
    sidebar.appendChild(tabButton);

    var tabItemView = document.createElement("div");
    tabItemView.id = value;
    tabItemView.classList.add("tab-content");
    tabView.appendChild(tabItemView);

    menuItems[value] = tabItemView;
});

db.directory.each(loadDirectoryHandle)

async function reloadFolders() {
    handles.forEach(async function(value, index, array) {
        let permission = await value.requestPermission()
        if (permission == "granted") {
            loadFolderFiles(value);
        };

    });
    folderSelect.innerText = "Select a Folder"
    folderSelect.onclick = loadDirectory;
}

async function loadFolderFiles(handle) {
    loader.style.display = "flex";
    loading.innerText = "loading music files..."
    const entries = [];
    for await (const entry of handle.values()) {
        if (entry.kind !== 'file') {
            continue;
        }
        if (entry.name == "[object File]") {
            continue;
        }
        entries.push(entry);
    }

    var loadEntries = new Promise(async (resolve, reject) => {
        const entryCount = entries.length;
        progressbar.style.display = "block";
        progressbarInner.style.width = "0%";
        let i = 0;
        for(const entry of entries) {
        //playAudio(v);
            await loadAudioMeta(entry);
            i++
            loading.innerText = "loading music files... (" + i + "/" + entryCount + ")";
            progressbarInner.style.width = (i / entryCount * 100) + "%";

        }
        progressbar.style.display = "none";

        resolve();
    });
    
    loadEntries.then(() => {
        loader.style.display = "none";
    })
}

async function tagArtToDataURL(tags) {
    var base64String = "";

  for (var i = 0; i < tags.picture.data.length; i++) {
    base64String += String.fromCharCode(tags.picture.data[i]);
  }
  var dataUrl = "data:" + tags.picture.format + ";base64," +window.btoa(base64String);
  return dataUrl;
}

function createAlbumElement(album) {
    let albumEl = document.createElement("div");
    albumEl.classList.add("album");

    let albumTitle = document.createElement("div");
    albumTitle.innerText = album;
    albumTitle.classList.add("album-title");
    albumEl.appendChild(albumTitle);

    let albumContent = document.createElement("div");
    albumContent.classList.add("album-content");
    albumEl.appendChild(albumContent);

    return albumEl;
}

function createArtistElement(artist) {
    let artistEl = document.createElement("div");
    artistEl.classList.add("artist");

    let artistTitle = document.createElement("div");
    artistTitle.innerText = artist;
    artistTitle.classList.add("artist-title");
    artistEl.appendChild(artistTitle);

    let artistContent = document.createElement("div");
    artistContent.classList.add("artist-content");
    artistEl.appendChild(artistContent);

    return artistEl;
}

async function createSongElement(handle, tags) {
    console.log("++TAGS++", tags)
    let song = document.createElement("div");

    let url = "disk.png";
    if (Object.keys(tags).includes("picture")) {
        url = await tagArtToDataURL(tags);
    }

    if (Object.keys(tags).includes("album")) {
        album = tags.album;
    } else {
        album = "Unknown Album";
    }

    if (!Object.keys(albumElements).includes(album)) {
        albumElements[album] = createAlbumElement(album);
        menuItems["albums"].appendChild(albumElements[album]);
    }

    if (Object.keys(tags).includes("artist")) {
        artist = tags.artist;
    } else {
        artist = "Unknown artist";
    }

    if (!Object.keys(artistElements).includes(artist)) {
        artistElements[artist] = createArtistElement(artist);
        menuItems["artists"].appendChild(artistElements[artist]);
    }

    let title = document.createElement("div");
    title.classList.add("song-title");
    song.appendChild(title)
    title.innerText = tags.title;

    songAlbum = song.cloneNode(true)
    songArtist = song.cloneNode(true)

    song.onclick = (event) => {
        playAudio(handle, url, tags)
    };

    songAlbum.onclick = (event) => {
        playAudio(handle, url, tags)
    };

    songArtist.onclick = (event) => {
        playAudio(handle, url, tags)
    };

    songAlbum.classList.add("album-song")
    songArtist.classList.add("artist-song")

    song.classList.add("song");

    albumElements[album].getElementsByClassName("album-content")[0].appendChild(songAlbum);
    artistElements[artist].getElementsByClassName("artist-content")[0].appendChild(songArtist);


    let image = document.createElement("img");
    image.src = url;
    song.insertBefore(image, title);

    return song;
}

async function loadAudioMeta(handle) {
    return new Promise(async (resolve, reject) => {
        jsmediatags.read(await handle.getFile(), {
        
            onSuccess: async function(tag) {
                tags = tag.tags;
                console.log(tags);
                if (!Object.keys(tags).includes("title")) {
                    tags.title = handle.name.split(".")[0];
                }
                menuItems["songs"].appendChild(
                    await createSongElement(handle, tags)
                    );
                resolve();

        },

        onError: async function(error) {
            
            menuItems["songs"].appendChild(
                await createSongElement(handle, {
                    title: handle.name.split(".")[0]
                })
            );
            resolve();
        }
    });

    });
}

async function loadDirectoryHandle(handleRow) {
    handle = handleRow.handle;
    handles.push(handle);
    var hasPermission = await handle.queryPermission();
    if (hasPermission == "prompt") {
        folderSelect.innerText = "Reload Folders"
        folderSelect.onclick = reloadFolders;
    }
    else if (hasPermission == "denied") {
        db.directory.delete(handleRow.name);
    }
    else {
        loadFolderFiles(handle);
    }
}

async function loadDirectory() {
    loader.style.display = "flex";
    loading.innerText = "waiting for you to choose a folder..."
    try {
        directory = await window.showDirectoryPicker({
            "id": "offbeat",
            "mode": "read",
            "startIn": "music"
        });
    } catch (error) {
        loader.style.display = "none";
        return;
    }

    db.directory.put({name: directory.name, handle: directory});
    await loadFolderFiles(directory);
}

setInterval(updateSeekBar, 500);