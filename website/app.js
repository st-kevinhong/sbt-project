let accounts = [];
let web3;
const ETHERSCAN_API_KEY = 'YOUR_ETHERSCAN_API_KEY'; // Etherscan에서 받은 API 키

async function connectEthereum() {
    if (!window.ethereum && !window.web3) {
        console.log('Non-Ethereum browser detected. Consider using MetaMask.');
        updateUI(false);
        return;
    }

    if (window.ethereum) {
        web3 = new Web3(window.ethereum);

        try {
            accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            updateUI(true);
            window.ethereum.on('accountsChanged', function (_accounts) {
                accounts = _accounts;
                if (accounts.length > 0) {
                    updateUI(true);
                } else {
                    updateUI(false);
                }
            });
        } catch (error) {
            console.error("User denied account access:", error);
            updateUI(false);
        }
    } else if (window.web3) {
        web3 = new Web3(window.web3.currentProvider);
        accounts = await web3.eth.getAccounts();
        if (accounts && accounts.length > 0) {
            updateUI(true);
        } else {
            updateUI(false);
        }
    }
}

async function getRecentTransactions() {
    if (!accounts || accounts.length === 0) {
        alert("Please connect your Ethereum wallet first.");
        return;
    }

    const address = accounts[0];
    const ETHERSCAN_API_KEY = 'FVWM4RX3F3KXM5I72CS1BSKKE783M3MXD3'; // 이곳에 Etherscan API 키를 입력하세요.
    const etherscanURL = `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;

    try {
        const response = await fetch(etherscanURL);
        const data = await response.json();

        if (data.status !== "1" || !data.result) {
            throw new Error("Failed to fetch transactions.");
        }

        const transactions = data.result.slice(0, 10); // 최근 10개의 트랜잭션만 가져옵니다.

        // UI에 트랜잭션 정보 표시 (예: 테이블 또는 리스트에 추가)
        displayTransactions(transactions);

    } catch (error) {
        console.error("Error fetching transactions:", error);
    }
}

function displayTransactions(transactions) {
    const transactionsTableBody = document.querySelector("#transactionsTable tbody");
    transactionsTableBody.innerHTML = ""; // 기존 행 삭제

    for (const tx of transactions) {
        const row = transactionsTableBody.insertRow();

        const hashCell = row.insertCell(0);
        hashCell.textContent = tx.hash;

        const valueCell = row.insertCell(1);
        valueCell.textContent = web3.utils.fromWei(tx.value, 'ether');
    }
}

function disconnectEthereum() {
    accounts = [];
    if (window.ethereum) {
        window.ethereum.removeAllListeners();
    }
    updateUI(false);
}

function updateUI(isConnected) {
    if (isConnected && accounts.length > 0) {
        document.getElementById("walletButton").textContent = "Disconnect";
        const displayedAddress = `${accounts[0].substr(0, 6)}...${accounts[0].substr(-4)}`;
        document.getElementById("connectedAddress").textContent = displayedAddress;
    } else {
        document.getElementById("walletButton").textContent = "Connect Wallet";
        document.getElementById("connectedAddress").textContent = "";
    }
}

function issueVC() {
    const receiverAddress = document.getElementById("receiverAddress").value;
    const userName = document.getElementById("name").value;
    const userDOB = document.getElementById("dob").value;
    const studentNumber = document.getElementById("studentId").value;
    
    // DID 자동 생성
    const did = 'did:example:' + uuidv4();

    const vc = {
        "@context": "https://www.w3.org/2018/credentials/v1",
        "id": did,
        "type": ["VerifiableCredential"],
        "issuer": accounts[0],
        "issuanceDate": new Date().toISOString(),
        "credentialSubject": {
            "id": did,
            "name": userName,
            "dateOfBirth": userDOB,
            "studentNumber": studentNumber
        }
    };

    // 이 부분에서 우측 textarea에 VC 출력
    document.getElementById("issuedVC").value = JSON.stringify(vc, null, 4);

    const vcHash = web3.utils.sha3(JSON.stringify(vc));

    const contract = new web3.eth.Contract(contractABI, contractAddress);
    contract.methods.mint(receiverAddress, vcHash).send({ from: accounts[0] })
        .on('receipt', function(receipt){
            console.log('VC issued successfully!', receipt);
        })
        .on('error', function(error){
            console.error("Error issuing VC", error);
        });
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function downloadJSON() {
    const data = document.getElementById("issuedVC").value;
    const blob = new Blob([data], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = 'VC.json';

    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
}

function showPage(pageId) {
    const pages = ['issueVC', 'viewVCPage', 'verifyVCPage'];
    for (let id of pages) {
        if (id === pageId) {
            document.getElementById(id).style.display = 'block';
            // 여기에 로직을 추가
            if (id === 'viewVCPage') {
                getRecentTransactions();
            }
        } else {
            document.getElementById(id).style.display = 'none';
        }
    }
}

function verifyVP() {
    // TODO: Add actual verification logic here

    // For this example, we'll simply display "Verified!"
    document.getElementById("verificationResult").textContent = "Verified!";
}

document.addEventListener("DOMContentLoaded", function() {
    document.getElementById("walletButton").addEventListener("click", async function(event) {
        event.preventDefault();
        if (document.getElementById("walletButton").textContent === "Connect Wallet") {
            try {
                await connectEthereum();
            } catch (err) {
                console.error("Error connecting to Ethereum:", err);
            }
        } else {
            disconnectEthereum();
        }
    });

    document.getElementById("vcForm").querySelector("button").addEventListener("click", issueVC);

    document.getElementById("viewVCPage").addEventListener("load", getRecentTransactions);

    document.querySelector(".menu").addEventListener("click", function(event) {
        if (event.target.tagName === "A") {
            event.preventDefault();
            const targetHref = event.target.getAttribute('href').substr(1);
            if (targetHref === 'issueVC') {
                showPage('issueVC');
            } else {
                const pageId = targetHref + "Page";
                showPage(pageId);
            }
        }
    });
});
