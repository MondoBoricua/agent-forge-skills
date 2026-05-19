# Kali Mac Tool Playbook

Use these workflows only for owned networks, local lab machines, CTF platforms,
Hack The Box-style targets, or explicitly authorized scopes. Replace all
placeholders with user-approved values.

## First Questions

Before commands that touch a target, establish:

- Scope: `<target>`, `<cidr>`, or `<lab-vpn>`.
- Authorization: owned network, local VM, CTF, HTB, or written approval.
- Access path: native macOS tool, Kali VM/container, or SSH to Kali lab host.
- Output location: local notes/report path that does not expose private data.

## Access From macOS

Check local tools:

```bash
command -v nmap rustscan masscan ffuf gobuster feroxbuster dirsearch nikto sqlmap hashcat john hydra msfconsole netexec tshark wireshark docker colima ssh
```

Use SSH to a local Kali lab host when the user has one configured:

```bash
ssh <kali-host>
ssh <kali-host> 'command -v nmap && nmap --version'
```

Do not assume a host alias. If the context does not define it, ask for the SSH
host or suggest checking:

```bash
ssh -G <host> | sed -n '1,40p'
```

## HTB Or CTF VPN

Use only official VPN configs from the platform account.

WireGuard:

```bash
wg-quick up <config>
wg show
ip route 2>/dev/null || netstat -rn
```

OpenVPN:

```bash
sudo openvpn --config <lab.ovpn>
```

Confirm the assigned lab IP without probing targets:

```bash
ifconfig
netstat -rn
```

## Local Network Discovery

For owned networks only. Start gentle:

```bash
nmap -sn <cidr>
```

Identify services on approved hosts:

```bash
nmap -sV -sC -oA scan-basic <target>
```

For faster discovery on a lab subnet:

```bash
rustscan -a <target-or-cidr> --ulimit 5000 -- -sV
```

Use `masscan` only with explicit approval and conservative rates:

```bash
sudo masscan <cidr> -p80,443,22 --rate 1000
```

## Web App Assessment

Confirm target:

```bash
curl -I http://<target>/
```

Content discovery:

```bash
ffuf -u http://<target>/FUZZ -w <wordlist> -mc all -fc 404
gobuster dir -u http://<target>/ -w <wordlist>
feroxbuster -u http://<target>/ -w <wordlist>
dirsearch -u http://<target>/ -w <wordlist>
```

Baseline web checks:

```bash
nikto -h http://<target>/
```

SQL injection testing only on owned/CTF apps:

```bash
sqlmap -u 'http://<target>/path?id=1' --batch --risk 1 --level 1
```

## Credentials And Password Policy Labs

Use only owned accounts, toy data, CTF challenge material, or approved policy
validation sets. Do not paste secrets into chat.

Hash identification:

```bash
hashid <hash-file>
john --list=formats | grep -i <keyword>
hashcat --help | grep -i <keyword>
```

John:

```bash
john --wordlist=<wordlist> <hash-file>
john --show <hash-file>
```

Hashcat:

```bash
hashcat -m <mode> -a 0 <hash-file> <wordlist> --status --status-timer 30
```

Hydra only for owned services or explicit lab targets:

```bash
hydra -L <users> -P <passwords> <target> ssh -V -f
```

Prefer defensive output: weak policy, affected test account, rotation needed,
rate limits, MFA recommendations.

## SMB And Windows Lab Enumeration

For owned Windows labs or CTF targets:

```bash
smbclient -L //<target>/ -N
netexec smb <target> --shares
enum4linux-ng <target>
```

Keep output scoped to service exposure and remediation. Do not publish real
users, shares, hostnames, or domain details.

## Packet Capture

Capture only on interfaces and networks you own or are authorized to inspect.

```bash
sudo tcpdump -i <interface> -w capture.pcap host <target>
tshark -r capture.pcap
wireshark capture.pcap
```

Summarize protocols, endpoints, and risks without exposing payload secrets.

## Metasploit

Use Metasploit only for local vulnerable VMs, CTFs, or explicitly authorized
validation. Prefer module info and safe checks before running anything.

```bash
msfconsole
search <service> <version>
info <module>
check
```

Do not provide steps for persistence, evasion, payload delivery against real
systems, or post-exploitation beyond safe lab cleanup and remediation notes.

## Reporting

Use this structure:

```text
Scope: <approved scope>
Tools used: <tools>
Finding: <what was observed>
Evidence: <sanitized evidence path or short summary>
Risk: <impact>
Fix: <remediation>
Retest: <bounded validation command>
```

Never include private IP maps, credentials, hashes, potfiles, dumps, customer
names, or raw report rows in public artifacts.
