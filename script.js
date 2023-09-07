var tabView = document.getElementById("bar-view")
var sidebar = document.getElementById("sidebar")

var menu = {
    "home": function() {
        console.log("Tab")
    }
}

Object.keys(menu).forEach(tab => {
    var tabButton = document.createElement("div");
    tabButton.classList.add("tab-button");
    tabButton.onclick = menu[tab];
    tabButton.innerText = tab;
    sidebar.appendChild(tabButton)
});