package main
import ("fmt";"go/ast";"go/parser";"go/token";"os")
func main(){
  fset:=token.NewFileSet()
  f,err:=parser.ParseFile(fset,os.Args[1],nil,0)
  if err!=nil{ fmt.Println("PARSE_ERROR:",err); os.Exit(2) }
  found:=false
  ast.Inspect(f,func(n ast.Node)bool{
    st,ok:=n.(*ast.StructType); if !ok { return true }
    for _,fld:=range st.Fields.List{
      if sel,ok:=fld.Type.(*ast.SelectorExpr); ok {
        if x,ok:=sel.X.(*ast.Ident); ok && x.Name=="context" && sel.Sel.Name=="Context" { found=true }
      }
    }
    return true
  })
  if found { fmt.Println("FAIL: context.Context stored as struct field (anti-pattern)"); os.Exit(1) }
  fmt.Println("PASS: no context in struct"); os.Exit(0)
}
