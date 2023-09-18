var tabView = document.getElementById("bar-view")
var sidebar = document.getElementById("sidebar")
var folderSelect = document.getElementById("folder-select")
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

// Play local audio file.
async function playAudio (fileHandle, imageURL, tags) {
  const file = await fileHandle.getFile();
  const arrayBuffer = await file.arrayBuffer();
  const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);

  document.getElementById("currently-playing-art").src = imageURL;
  document.getElementById("currently-playing-title").innerText = tags.title;


  // Create source node
  const source = ctx.createBufferSource();
  source.buffer = decodedBuffer;
  source.connect(ctx.destination);
  source.start(); 
}

var directory;
var db = new Dexie("offbeat");
db.version(1).stores({
    directory: `
    name,
    handle`,
});

var handles = [];

var songs = {
    "Unknown Album": [
        [
            "Long Long Journey",
            "Bill Wurtz"
        ]
    ]
}

var menu = [
    "home",
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
      entries.forEach((v, i, a) => {
       //playAudio(v);
       loadAudioMeta(v);
      });
}

async function tagArtToDataURL(tags) {
    var base64String = "";

  for (var i = 0; i < tags.picture.data.length; i++) {
    base64String += String.fromCharCode(tags.picture.data[i]);
  }
  var dataUrl = "data:" + tags.picture.format + ";base64," +window.btoa(base64String);
  return dataUrl;
}

async function createSongElement(handle, tags) {
    let song = document.createElement("div");
    song.classList.add("song");

    let url = "disk.png";
    if (Object.keys(tags).includes("picture")) {
        url = await tagArtToDataURL(tags);
    }
    let image = document.createElement("img");
    image.src = url;
    song.appendChild(image);

    let title = document.createElement("div");
    title.classList.add("song-title");
    song.appendChild(title)
    title.innerText = tags.title;

    song.onclick = (event) => {
        playAudio(handle, url, tags)
    };

    return song;
}

async function loadAudioMeta(handle) {
    jsmediatags.read(await handle.getFile(), {onSuccess: async function(tag) {
        tags = tag.tags;
        console.log(tags);
        menuItems["home"].appendChild(
            await createSongElement(handle, tags)
            );

    }});
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
    directory = await window.showDirectoryPicker({
        "id": "offbeat",
        "mode": "read",
        "startIn": "music"
    });

    db.directory.put({name: directory.name, handle: directory});
    loadFolderFiles(directory);
}