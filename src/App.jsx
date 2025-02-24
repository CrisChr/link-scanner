import {useEffect, useState} from 'react'

function App() {
  const [links, setLinks] = useState([])
  const [showNotification, setShowNotification] = useState(false)
  const [folderTitle, setFolderTitle] = useState('')
  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState('')

  useEffect(() => {
    // Scan current tab for links
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      const tab = tabs[0]
      const results = await chrome.scripting.executeScript({
        target: {tabId: tab.id}, function: () => {
          const linkPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/g
          const text = document.body.innerText
          return Array.from(text.matchAll(linkPattern), m => m[0])
        }
      })

      const uniqueLinks = [...new Set(results[0].result)]
      setLinks(uniqueLinks.map(link => ({
        url: link.startsWith('www.') ? `https://${link}` : link, checked: false
      })))
    })

    // Fetch existing folders
    chrome.bookmarks.getTree((bookmarkTreeNodes) => {
      console.log(bookmarkTreeNodes)
      const folders = []
      const traverseBookmarks = (nodes) => {
        nodes.forEach(node => {
          if (node.children) {
            folders.push(node)
            traverseBookmarks(node.children)
          }
        })
      }
      traverseBookmarks(bookmarkTreeNodes)
      setFolders(folders)
    })
  }, [])

  const toggleLink = (index) => {
    setLinks(links.map((link, i) => i === index ? {...link, checked: !link.checked} : link))
  }

  const toggleAll = () => {
    const allChecked = links.every(link => link.checked)
    setLinks(links.map(link => ({...link, checked: !allChecked})))
  }

  const openSelectedLinks = () => {
    links.forEach(link => {
      if (link.checked) {
        chrome.tabs.create({url: link.url})
      }
    })
  }

  const saveToBookmarks = () => {
    const checkedLinks = links.filter(link => link.checked)
    if (checkedLinks.length > 0) {
      checkedLinks.forEach(link => {
        chrome.bookmarks.create({
          title: link.url, url: link.url
        })
      })
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
    }
  }

  const createFolder = () => {
    const checkedLinks = links.filter(link => link.checked)
    if (checkedLinks.length > 0) {
      if (selectedFolder === 'new' && folderTitle.trim() !== '') {
        chrome.bookmarks.create({title: folderTitle}, (newFolder) => {
          checkedLinks.forEach(link => {
            chrome.bookmarks.create({
              parentId: newFolder.id, title: link.url, url: link.url
            })
          })
        })
      } else if (selectedFolder !== 'new') {
        checkedLinks.forEach(link => {
          chrome.bookmarks.create({
            parentId: selectedFolder, title: link.url, url: link.url
          })
        })
      }
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
    }
  }

  const allChecked = links.length > 0 && links.every(link => link.checked)

  return (<div className="w-96 p-4 bg-white relative flex flex-col h-full">
    <h1 className="text-xl font-bold mb-4">Link Scanner</h1>

    {!!links.length ? (<div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-200">
      <span className="min-w-[24px]"/>
      <div className="relative flex items-center">
        <input
            type="checkbox"
            checked={allChecked}
            onChange={toggleAll}
            className="w-4 h-4 appearance-none border-2 border-gray-300 rounded cursor-pointer checked:bg-blue-500 checked:border-blue-500 transition-colors duration-200 ease-in-out"
        />
        <svg
            className="absolute w-4 h-4 pointer-events-none text-white transform scale-0 transition-transform duration-200 ease-in-out peer-checked:scale-100"
            viewBox="0 0 17 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
          <path d="M1 4.5L5.5 9L15 1"/>
        </svg>
      </div>
      <span className="text-sm text-gray-500">{allChecked ? 'Unselect All' : 'Select All'}</span>
    </div>) : <div className="flex items-center flex-col justify-center">
      <span className="text-lg text-gray-500">No links found</span>
    </div>}

    <div className="space-y-2 mb-4 max-h-96 overflow-y-auto flex-1">
      {links.map((link, index) => (<div key={index} className="flex items-center gap-3">
          <span className="min-w-[24px] text-sm text-gray-500 text-right">
            {(index + 1).toString().padStart(2, '')}.
          </span>
        <div className="relative flex items-center">
          <input
              type="checkbox"
              checked={link.checked}
              onChange={() => toggleLink(index)}
              className="w-4 h-4 appearance-none border-2 border-gray-300 rounded cursor-pointer checked:bg-blue-500 checked:border-blue-500 transition-colors duration-200 ease-in-out"
          />
          <svg
              className="absolute w-4 h-4 pointer-events-none text-white transform scale-0 transition-transform duration-200 ease-in-out peer-checked:scale-100"
              viewBox="0 0 17 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
          >
            <path d="M1 4.5L5.5 9L15 1"/>
          </svg>
        </div>
        <span
            className="text-sm truncate cursor-default hover:text-blue-600 flex-1"
            title={link.url}
        >
            {link.url}
          </span>
      </div>))}
    </div>

    {!!links.length && <div className="flex gap-2">
      <button
          onClick={openSelectedLinks}
          className="flex-1 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
      >
        Open selected links
      </button>
      <button
          onClick={saveToBookmarks}
          className="flex-1 bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
      >
        Save links to bookmarks
      </button>
    </div>}

    {!!links.length && <div className="flex gap-2 mt-4">
      <select
          value={selectedFolder}
          onChange={(e) => setSelectedFolder(e.target.value)}
          className="flex-1 px-4 py-2 border rounded"
      >
        <option value="">Select Folder</option>
        <option value="new">Create a New Folder</option>
        {folders.map(folder => (<option key={folder.id} value={folder.id}>{folder.title}</option>))}
      </select>
      {selectedFolder === 'new' && (<input
          type="text"
          value={folderTitle}
          onChange={(e) => setFolderTitle(e.target.value)}
          placeholder="Folder Title"
          className="flex-1 px-4 py-2 border rounded"
      />)}
      <button
          onClick={createFolder}
          className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600"
      >
        Save links to folder
      </button>
    </div>}

    {/* Success Notification */}
    {showNotification && (<div
        className="absolute bottom-40 left-1/2 transform -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded shadow-lg">
      Save to bookmarks successfully
    </div>)}
  </div>)
}

export default App
