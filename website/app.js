let accounts = [];
let web3;

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

function disconnectEthereum() {
    accounts = [];  // Reset the accounts array
    if(window.ethereum) {
        window.ethereum.removeAllListeners();  // Ensure no more account change events are observed
    }
    updateUI(false);  // Update UI to show as disconnected
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
        } else {
            document.getElementById(id).style.display = 'none';
        }
    }
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
