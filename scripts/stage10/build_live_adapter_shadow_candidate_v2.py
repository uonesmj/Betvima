#!/usr/bin/env python3
"""Stage10 shadow-only patch of exact pinned active source. No live writes or DB use."""
import hashlib,re,os,tempfile
from pathlib import Path
ROOT=Path("/opt/nova-releases/casino-3098-eligible-fallback-HU6Rbl")
SRC=ROOT/"src/server/db/postgres.ts"
OUT=Path("/root/betvima-stage5/stage10-timeout-candidate/live-shadow/postgres.ts")
PIN="3d66c5724ff6"
START="class TransactionDb implements Db {"
FIRST="  private async run<"
LAST="\n  query<"
FIELD="\n  private stage10AppliedTimeoutSql: string | null = null;\n"
pattern=(r"(?mi)^([ \t]*)await[ \t]+this\.client\.query[ \t]*\([ \t]*"
         r"(<BT>set[ \t]+local[ \t]+statement_timeout[ \t]*=[ \t]*"
         r"<D>[^<BT>\r\n]+}<BT>)[ \t]*\)[ \t]*;[ \t]*$")
pattern=pattern.replace("<BT>",chr(96)).replace("<D>",chr(92)+chr(36)+"{")
RX=re.compile(pattern)
def short(b):return hashlib.sha256(b).hexdigest()[:12]
def main():
 print("STAGE10_SHADOW_V2_ISOLATED_ONLY=true")
 if not SRC.is_file() or SRC.is_symlink() or not SRC.resolve().is_relative_to(ROOT.resolve()):
  print("STAGE10_ABORT=SOURCE_PATH_UNEXPECTED");return 2
 raw=SRC.read_bytes()
 if len(raw)>100000 or short(raw)!=PIN:
  print("STAGE10_ABORT=SOURCE_HASH_CHANGED");return 2
 code=raw.decode("utf8","strict")
 if code.count(START)!=1 or code.count(FIRST)!=1:
  print("STAGE10_ABORT=TRANSACTION_STRUCTURE_DIFFERENT");return 2
 a,tail=code.split(START,1)
 if FIRST not in tail or LAST not in tail:
  print("STAGE10_ABORT=METHOD_BOUNDARIES_DIFFERENT");return 2
 ctor,post=tail.split(FIRST,1)
 run,after=post.split(LAST,1)
 matches=list(RX.finditer(run))
 print("STAGE10_SET_LOCAL_LINES_MATCHED="+str(len(matches)))
 query_present=bool(re.search(r"this\.client\.query[ \t]*\([ \t]*sql\b",run))
 print("STAGE10_TARGET_SQL_QUERY_PRESENT="+str(query_present).lower())
 if len(matches)!=1 or not query_present or "stage10AppliedTimeoutSql" in code:
  print("STAGE10_ABORT=UNRECOGNIZED_SAFE_PATCH_SHAPE");return 2
 m=matches[0]
 indent,template=m.group(1),m.group(2)
 old=m.group(0)
 new=(
  indent+"const stage10TimeoutSql = "+template+";\n"
  +indent+"if (this.stage10AppliedTimeoutSql !== stage10TimeoutSql) {\n"
  +indent+"  await this.client.query(stage10TimeoutSql);\n"
  +indent+"  this.stage10AppliedTimeoutSql = stage10TimeoutSql;\n"
  +indent+"}\n"
  +indent+"if (/\\b(?:set|reset)\\s+(?:local\\s+|session\\s+)?statement_timeout\\b"
  "|\\b(?:reset\\s+all|set_config\\s*\\(|rollback\\s+to\\b|savepoint\\b|release\\s+savepoint\\b)"
  "/i.test(sql)) {\n"
  +indent+"  this.stage10AppliedTimeoutSql = null;\n"
  +indent+"}"
 )
 updated_run=run[:m.start()]+new+run[m.end():]
 patched=a+START+FIELD+ctor+FIRST+updated_run+LAST+after
 if patched==code or patched.replace(START+FIELD,START,1).replace(new,old,1)!=code:
  print("STAGE10_ABORT=SHADOW_PATCH_NOT_EXACT");return 2
 if OUT.parent.is_symlink() or (OUT.exists() and (OUT.is_symlink() or not OUT.is_file())):
  print("STAGE10_ABORT=SHADOW_OUTPUT_UNSAFE");return 2
 OUT.parent.mkdir(parents=True,mode=0o700,exist_ok=True)
 os.chmod(OUT.parent,0o700)
 fd,name=tempfile.mkstemp(prefix=".shadow-",suffix=".ts",dir=OUT.parent)
 try:
  os.fchmod(fd,0o600)
  with os.fdopen(fd,"w",encoding="utf8") as f:f.write(patched)
  os.replace(name,OUT)
 finally:
  if os.path.exists(name):os.unlink(name)
 print("STAGE10_LIVE_SOURCE_PINNED=true")
 print("STAGE10_EXACT_TWO_LOCATION_DIFF=true")
 print("STAGE10_SHADOW_HASH12="+short(patched.encode()))
 print("STAGE10_LIVE_SOURCE_MODIFIED=false")
 print("STAGE10_3098_RESTARTED=false")
 print("STAGE10_FINANCIAL_REQUESTS=0")
 print("STAGE10_SHADOW_BUILD=PASS")
 return 0
if __name__=="__main__":raise SystemExit(main())
