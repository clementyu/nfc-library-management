document.addEventListener('DOMContentLoaded', () => {
    const ws = new WebSocket(`ws://${window.location.host}`);

    const titleInput = document.getElementById('title');
    const authorInput = document.getElementById('author');
    const publisherInput = document.getElementById('publisher');
    const registerBtn = document.getElementById('register-btn');
    const checkInBtn = document.getElementById('check-in-btn');
    const checkOutBtn = document.getElementById('check-out-btn');
    const downloadBtn = document.getElementById('download-btn');
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');
    const scannedTagP = document.getElementById('scanned-tag');
    const bookListBody = document.getElementById('book-list-body');

    let lastScannedUid = null;
    let currentBookListData = ''; // To store the raw TSV data

    ws.onmessage = event => {
        const message = JSON.parse(event.data);
        if (message.type === 'tag') {
            lastScannedUid = message.uid;
            const statusClass = message.status === 'Checked-Out' ? 'status-checked-out' : '';
            scannedTagP.innerHTML = `
                <strong>Title:</strong> ${message.title} <br> 
                <strong>UID:</strong> ${lastScannedUid} <br>
                <strong>Status:</strong> <span class="${statusClass}">${message.status}</span>`;
        } else if (message.type === 'book-list') {
            currentBookListData = message.data;
            displayBookList(currentBookListData, searchInput.value); // Re-apply search filter on update
        }
    };

    registerBtn.addEventListener('click', () => {
        const book = {
            uid: lastScannedUid || prompt("No tag scanned. Please enter NFC Tag UID:"),
            title: titleInput.value,
            author: authorInput.value,
            publisher: publisherInput.value,
        };
        if (book.uid && book.title) {
            ws.send(JSON.stringify({ command: 'register', payload: book }));
            titleInput.value = '';
            authorInput.value = '';
            publisherInput.value = '';
        } else {
            alert('Please provide a Title and scan an NFC tag (or enter a UID).');
        }
    });

    checkInBtn.addEventListener('click', () => {
        if (lastScannedUid) {
            ws.send(JSON.stringify({ command: 'check-in', uid: lastScannedUid }));
        } else {
            alert('Please scan a book\'s NFC tag to check it in.');
        }
    });

    checkOutBtn.addEventListener('click', () => {
        if (lastScannedUid) {
            ws.send(JSON.stringify({ command: 'check-out', uid: lastScannedUid }));
        } else {
            alert('Please scan a book\'s NFC tag to check it out.');
        }
    });

    downloadBtn.addEventListener('click', () => {
        const blob = new Blob([currentBookListData], { type: 'text/tab-separated-values' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'books.tsv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    searchBtn.addEventListener('click', () => {
        const searchTerm = searchInput.value;
        displayBookList(currentBookListData, searchTerm);
    });
    
    searchInput.addEventListener('keyup', (event) => {
        const searchTerm = searchInput.value;
        displayBookList(currentBookListData, searchTerm);
    });


    function displayBookList(data, searchTerm = '') {
        bookListBody.innerHTML = '';
        let rows = data.trim().split('\n');
        if (rows.length <= 1) return; 

        const header = rows[0];
        let bookRows = rows.slice(1);

        if (searchTerm) {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            bookRows = bookRows.filter(row => {
                const title = row.split('\t')[1]; // Title is the second column
                return title && title.toLowerCase().includes(lowerCaseSearchTerm);
            });
        }
        
        bookRows.forEach(row => {
            const columns = row.split('\t');
            if (columns.length < 6) return; // Now expecting 6 columns
            
            const tr = document.createElement('tr');
            columns.forEach(col => {
                const td = document.createElement('td');
                td.textContent = col;
                tr.appendChild(td);
            });
            bookListBody.appendChild(tr);
        });
    }
});
