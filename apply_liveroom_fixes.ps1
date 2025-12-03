// Script PowerShell pour appliquer toutes les modifications à LiveRoom.jsx

$file = 'd:\pf\p\minimeet\src\pages\LiveRoom.jsx'
$content = Get-Content $file -Raw

// Modification 1 : Ligne 183 - Condition pour hôte ET invités
$content = $content -replace 'if \(isHost && currentUser && localStream\)', 'if ((isHost || isGuest) && currentUser && localStream)'

// Modification 2 : Ligne 190 - Console.log dynamique
$content = $content -replace "console\.log\('Hôte répond à l\\'appel d\\'un spectateur'\);", 'console.log(`${isHost ? ''Hôte'' : ''Invité''} répond à l''appel d''un spectateur`);'

// Modification 3 : Ligne 202 - Dépendances useEffect
$content = $content -replace '\}, \[isHost, currentUser, localStream\]\);', '}, [isHost, isGuest, currentUser, localStream]);'

// Modification 4 : Ligne 206 - Condition spectateurs
$content = $content -replace 'if \(!isHost && peerInstance && live\?\.host_id && !isGuest\)', 'if (!isHost && !isGuest && peerInstance && live?.host_id)'

// Modification 5 : Ligne 230 - Condition init PeerJS viewers
$content = $content -replace 'if \(!isHost && currentUser && !peerInstance\)', 'if (!isHost && !isGuest && currentUser && !peerInstance)'

// Modification 6 : Ligne 243 - Dépendances useEffect viewers
$content = $content -replace '\}, \[isHost, currentUser, peerInstance\]\);', '}, [isHost, isGuest, currentUser, peerInstance]);'

Set-Content $file $content
Write-Host "Modifications appliquées avec succès!"
